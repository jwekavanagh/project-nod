import { NextRequest } from "next/server";
import { activationJson, activationReserveDeny } from "@/lib/activationHttp";
import { authenticateApiKey, requireScopes } from "@/lib/apiKeyAuthGateway";
import {
  appendEnforcementEvent,
  createGovernanceEvidence,
  getBaseline,
  parseGovernanceEvidenceInput,
  verifyEvidenceHashes,
} from "@/lib/enforcementState";
import { canUseStatefulEnforcement } from "@/lib/enforcementEntitlement";

export async function POST(req: NextRequest) {
  const authn = await authenticateApiKey(req);
  if (!authn.ok) return authn.response;
  const scope = requireScopes(req, authn.principal, ["meter"]);
  if (!scope.ok) return scope.response;
  const ent = canUseStatefulEnforcement({
    plan: authn.principal.user.plan,
    subscriptionStatus: authn.principal.user.subscriptionStatus,
  });
  if (!ent.ok) {
    return activationReserveDeny(req, {
      status: 403,
      code: ent.code,
      message:
        ent.code === "ENFORCEMENT_REQUIRES_PAID_PLAN"
          ? "Stateful enforcement requires a paid plan."
          : "Subscription is not active for stateful enforcement.",
    });
  }

  let bodyUnknown: unknown;
  try {
    bodyUnknown = await req.json();
  } catch {
    return activationReserveDeny(req, { status: 400, code: "BAD_REQUEST", message: "Invalid JSON body." });
  }
  const body = parseGovernanceEvidenceInput(bodyUnknown);
  if (!body) {
    return activationReserveDeny(req, { status: 400, code: "BAD_REQUEST", message: "Missing governance evidence fields." });
  }
  const verified = verifyEvidenceHashes(body);
  if (!verified) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Evidence hash mismatch for certificate or material truth.",
    });
  }
  const evidenceId = await createGovernanceEvidence({
    userId: authn.principal.userId,
    workflowId: body.workflow_id,
    runId: body.run_id,
    certificate: body.outcome_certificate_v1,
    certificateSha256: verified.certificateSha256,
    materialTruth: verified.materialTruth,
    materialTruthSha256: verified.materialTruthSha256,
  });

  const baseline = await getBaseline({ userId: authn.principal.userId, workflowId: body.workflow_id });
  if (!baseline) {
    return activationReserveDeny(req, {
      status: 409,
      code: "ENFORCE_BASELINE_REQUIRED",
      message: "No accepted baseline exists. Run enforce with --create-baseline first.",
    });
  }
  if (baseline.needsRebaseline) {
    return activationReserveDeny(req, {
      status: 409,
      code: "ENFORCE_BASELINE_REBASE_REQUIRED",
      message: "Baseline must be recreated with evidence-native enforce before drift checks can run.",
    });
  }

  const isMatch = baseline.projectionHash === verified.materialTruthSha256;
  await appendEnforcementEvent({
    userId: authn.principal.userId,
    workflowId: body.workflow_id,
    runId: body.run_id,
    event: isMatch ? "check_pass" : "drift_detected",
    expectedProjectionHash: baseline.projectionHash,
    actualProjectionHash: verified.materialTruthSha256,
    evidenceId,
    metadata: {
      certificate_sha256: verified.certificateSha256,
      run_kind: body.outcome_certificate_v1.runKind,
      reliance_class: body.outcome_certificate_v1.runKind === "quick_preview" ? "provisional" : "eligible",
    },
  });

  return activationJson(
    req,
    {
      schema_version: 1,
      status: isMatch ? "ok" : "drift",
      workflow_id: body.workflow_id,
      expected_projection_hash: baseline.projectionHash,
      actual_projection_hash: verified.materialTruthSha256,
      quota_enforced_via_reserve: true,
    },
    200,
  );
}

