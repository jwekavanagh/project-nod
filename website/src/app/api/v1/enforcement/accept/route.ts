import { NextRequest } from "next/server";
import { activationJson, activationReserveDeny } from "@/lib/activationHttp";
import { authenticateApiKey, requireScopes } from "@/lib/apiKeyAuthGateway";
import {
  createGovernanceEvidence,
  parseAcceptEvidenceInput,
  verifyEvidenceHashes,
} from "@/lib/enforcementState";
import { executeFsmAcceptDrift } from "@/lib/enforcementFsmPersistence";
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
  const body = parseAcceptEvidenceInput(bodyUnknown);
  if (!body) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message:
        "Missing governance evidence fields or accept requirements: expected_projection_hash and lifecycle_state_version.",
    });
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

  const outcome = await executeFsmAcceptDrift({
    principal: authn.principal,
    body,
    verified,
    evidenceId,
  });
  return activationJson(req, outcome.payload, outcome.httpStatus);
}
