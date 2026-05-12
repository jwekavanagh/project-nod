import { randomUUID } from "node:crypto";
import type { OutcomeCertificateV1 } from "agentskeptic";
import { canonicalCertificateSha256, materialTruthSha256 } from "agentskeptic/governanceEvidence";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LifecycleState } from "@/lib/verificationLifecycle";
import {
  evaluateAccept,
  evaluateCheck,
  evaluateCheckPreconditions,
  evaluateCreateBaseline,
} from "@/lib/verificationLifecycle";

type Principal = {
  userId: string;
  keyId: string;
  source: "v2";
  label: string;
  scopes: Array<"meter">;
  status: "active";
  user: { plan: string; subscriptionStatus: string; stripePriceId: string | null };
};

type MockFsmRow = {
  lifecycle: LifecycleState;
  version: number;
  baselineHash: string | null;
  pendingAccept: string | null;
  needsRebaseline: boolean;
};

const state = vi.hoisted(() => ({
  principal: {
    userId: "u1",
    keyId: "k1",
    source: "v2",
    label: "test",
    scopes: ["meter"] as Array<"meter">,
    status: "active" as const,
    user: { plan: "team", subscriptionStatus: "active", stripePriceId: null },
  } satisfies Principal,
}));

const fsmRows = vi.hoisted(() => ({ map: new Map<string, MockFsmRow>() }));

/** Stable v3 certificate + recomputed fingerprints (hosted ingestion SSOT parity). */
function governanceEnvelopeFor(workflowId: string, driftVariant: number): {
  outcome_certificate: OutcomeCertificateV1;
  certificate_sha256: string;
  material_truth_sha256: string;
} {
  const cert = structuredClone(
    hostedFixture.outcome_certificate,
  ) as unknown as OutcomeCertificateV1 & { steps: Array<{ observedOutcome: string }> };
  cert.workflowId = workflowId;
  cert.steps[0]!.observedOutcome = driftVariant === 0 ? "o" : `o-v${driftVariant}`;
  return {
    outcome_certificate: cert,
    certificate_sha256: canonicalCertificateSha256(cert),
    material_truth_sha256: materialTruthSha256(cert),
  };
}

function envelopePostJson(
  envelope: ReturnType<typeof governanceEnvelopeFor>,
  workflow_id: string,
  run_id: string,
): string {
  return JSON.stringify({
    schema_version: 3,
    run_id,
    workflow_id,
    material_truth_sha256: envelope.material_truth_sha256,
    certificate_sha256: envelope.certificate_sha256,
    outcome_certificate: envelope.outcome_certificate,
  });
}

function getFsmRow(wf: string): MockFsmRow {
  if (!fsmRows.map.has(wf)) {
    fsmRows.map.set(wf, {
      lifecycle: "baseline_missing",
      version: 0,
      baselineHash: null,
      pendingAccept: null,
      needsRebaseline: false,
    });
  }
  return fsmRows.map.get(wf)!;
}

/** Matches reserve-route.entitlement integration pattern so Bearer wf_sk_test authenticates via DB lookup mocks. */
const LOOKUP = "test_key_lookup_sha256_hex_64_chars________________________________";

vi.mock("@/lib/apiKeyCrypto", () => ({
  sha256HexApiKeyLookupFingerprint: () => LOOKUP,
  verifyApiKey: () => true,
}));

vi.mock("@/db/client", () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: async () => [{ id: randomUUID() }],
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(undefined),
      }),
    }),
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  key: {
                    id: state.principal.keyId,
                    keyHash: "scrypt$ignored",
                    keyLookupSha256: LOOKUP,
                    status: state.principal.status,
                    scopes: state.principal.scopes,
                    label: state.principal.label,
                    expiresAt: null as Date | null,
                  },
                  user: {
                    id: state.principal.userId,
                    plan: state.principal.user.plan,
                    subscriptionStatus: state.principal.user.subscriptionStatus,
                    stripePriceId: state.principal.user.stripePriceId,
                  },
                },
              ]),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/enforcementFsmPersistence", () => ({
  executeFsmCheck: vi.fn(async (params: {
    body: { workflow_id: string; run_id: string; outcome_certificate: { runKind: string } };
    verified: { materialTruthSha256: string; certificateSha256: string };
  }) => {
    const { body, verified } = params;
    const wf = body.workflow_id;
    const r = getFsmRow(wf);
    const baselineRowExists = r.baselineHash !== null;
    const precondition = evaluateCheckPreconditions({
      lifecycleBefore: r.lifecycle,
      baselineProjectionHash: r.baselineHash,
      baselineRowExists,
      baselineNeedsRebaseline: r.needsRebaseline,
      observedMaterialTruthSha256: verified.materialTruthSha256,
    });
    if (precondition?.kind === "precondition") {
      return {
        httpStatus: 409 as const,
        payload: {
          schema_version: 2 as const,
          code: precondition.responseCode,
          message: precondition.message,
        },
      };
    }

    const ev = evaluateCheck({
      lifecycleBefore: r.lifecycle,
      baselineProjectionHash: r.baselineHash,
      baselineRowExists,
      baselineNeedsRebaseline: r.needsRebaseline,
      observedMaterialTruthSha256: verified.materialTruthSha256,
    });
    const attemptId = crypto.randomUUID();
    const nextVersion = r.version + 1;
    r.lifecycle = ev.lifecycleAfter;
    r.version = nextVersion;
    r.pendingAccept = ev.pendingAcceptProjectionHash;

    const decisionState =
      ev.decisionState === "decision_trusted" ? ("decision_trusted" as const) : ("decision_blocked" as const);

    const expectAccept =
      ev.lifecycleAfter === "action_required" && ev.pendingAcceptProjectionHash ? ev.pendingAcceptProjectionHash : null;

    if (ev.httpStatus === 409) {
      return {
        httpStatus: 409 as const,
        payload: {
          schema_version: 2 as const,
          code: ev.responseCode,
          lifecycle_state: ev.lifecycleAfter,
          lifecycle_state_version: nextVersion,
          decision_state: decisionState,
          decision_reason_code: ev.decisionReasonCode,
          attempt_id: attemptId,
          workflow_id: body.workflow_id,
          run_id: body.run_id,
          next_action: ev.nextAction,
        },
      };
    }

    return {
      httpStatus: 200 as const,
      payload: {
        schema_version: 2 as const,
        code: "COMPLETED" as const,
        lifecycle_state: ev.lifecycleAfter,
        lifecycle_state_version: nextVersion,
        result_status: ev.resultStatus,
        decision_state: decisionState,
        decision_reason_code: ev.decisionReasonCode,
        attempt_id: attemptId,
        workflow_id: body.workflow_id,
        run_id: body.run_id,
        expected_projection_hash_for_accept: expectAccept,
        actual_projection_hash: verified.materialTruthSha256,
        next_action: ev.nextAction,
        quota_enforced_via_reserve: true,
      },
    };
  }),

  executeFsmCreateBaseline: vi.fn(async (params: {
    body: { workflow_id: string; run_id: string; outcome_certificate: { runKind: string } };
    verified: { materialTruthSha256: string; certificateSha256: string };
  }) => {
    const { body, verified } = params;
    const r = getFsmRow(body.workflow_id);
    const ver = evaluateCreateBaseline({
      lifecycleBefore: r.lifecycle,
      runKind: body.outcome_certificate.runKind,
    });
    if (!ver.ok) {
      return {
        httpStatus: ver.httpStatus,
        payload: { schema_version: 2 as const, code: ver.responseCode, message: ver.message },
      };
    }
    const attemptId = crypto.randomUUID();
    const nextVersion = r.version + 1;
    r.lifecycle = "baseline_active";
    r.baselineHash = verified.materialTruthSha256;
    r.pendingAccept = null;
    r.version = nextVersion;
    return {
      httpStatus: 200 as const,
      payload: {
        schema_version: 2 as const,
        code: "COMPLETED" as const,
        lifecycle_state: "baseline_active" as const,
        lifecycle_state_version: nextVersion,
        decision_state: "decision_trusted" as const,
        decision_reason_code: "BASELINE_ESTABLISHED" as const,
        attempt_id: attemptId,
        workflow_id: body.workflow_id,
        run_id: body.run_id,
        actual_projection_hash: verified.materialTruthSha256,
        next_action: ver.nextAction,
        quota_enforced_via_reserve: true,
      },
    };
  }),

  executeFsmAcceptDrift: vi.fn(async (params: {
    body: {
      workflow_id: string;
      run_id: string;
      expected_projection_hash: string;
      lifecycle_state_version: number;
      outcome_certificate: { runKind: string };
    };
    verified: { materialTruthSha256: string; certificateSha256: string };
  }) => {
    const { body, verified } = params;
    const r = getFsmRow(body.workflow_id);
    const ae = evaluateAccept({
      lifecycleBefore: r.lifecycle,
      lifecycleStateVersion: r.version,
      requestLifecycleVersion: body.lifecycle_state_version,
      requestExpectedProjectionHash: body.expected_projection_hash,
      pendingAcceptProjectionHash: r.pendingAccept,
      runKind: body.outcome_certificate.runKind,
    });
    if (!ae.ok) {
      return ae.responseCode === "BAD_REQUEST"
        ? { httpStatus: ae.httpStatus, payload: { schema_version: 2 as const, code: ae.responseCode, message: ae.message } }
        : {
            httpStatus: ae.httpStatus,
            payload: {
              schema_version: 2 as const,
              code: ae.responseCode,
              lifecycle_state: r.lifecycle,
              lifecycle_state_version: r.version,
              message: ae.message,
            },
          };
    }
    const nextVersion = r.version + 1;
    r.lifecycle = "rerun_required";
    r.baselineHash = verified.materialTruthSha256;
    r.pendingAccept = null;
    r.version = nextVersion;
    return {
      httpStatus: 200 as const,
      payload: {
        schema_version: 2 as const,
        code: "COMPLETED" as const,
        lifecycle_state: "rerun_required" as const,
        lifecycle_state_version: nextVersion,
        decision_state: null,
        decision_reason_code: null,
        workflow_id: body.workflow_id,
        run_id: body.run_id,
        accepted_projection_hash: verified.materialTruthSha256,
        next_action: ae.nextAction,
        quota_enforced_via_reserve: true,
      },
    };
  }),
}));

describe("enforcement state lifecycle", () => {
  beforeEach(() => {
    state.principal.user.plan = "team";
    state.principal.user.subscriptionStatus = "active";
    fsmRows.map.clear();
  });

  it("baseline create -> enforce pass -> drift fail -> accept -> enforce pass", async () => {
    const { POST: createBaseline } = await import("@/app/api/v1/enforcement/baselines/route");
    const { POST: check } = await import("@/app/api/v1/enforcement/check/route");
    const { POST: accept } = await import("@/app/api/v1/enforcement/accept/route");

    const v0 = governanceEnvelopeFor("wf-a", 0);
    const v1 = governanceEnvelopeFor("wf-a", 1);

    const mkReq = (url: string, run: string, envelope: ReturnType<typeof governanceEnvelopeFor>) =>
      new NextRequest(url, {
        method: "POST",
        headers: { authorization: "Bearer wf_sk_test", "content-type": "application/json" },
        body: envelopePostJson(envelope, "wf-a", run),
      });

    const b = await createBaseline(mkReq("http://localhost/api/v1/enforcement/baselines", "r1", v0));
    expect(b.status).toBe(200);
    const bj = (await b.json()) as { schema_version?: number; code?: string };
    expect(bj.schema_version).toBe(2);
    expect(bj.code).toBe("COMPLETED");

    const pass = await check(mkReq("http://localhost/api/v1/enforcement/check", "r2", v0));
    expect(pass.status).toBe(200);
    const pj = (await pass.json()) as { result_status?: string };
    expect(pj.result_status).toBe("match");

    const drift = await check(mkReq("http://localhost/api/v1/enforcement/check", "r3", v1));
    expect(drift.status).toBe(200);
    const dj = (await drift.json()) as {
      result_status?: string;
      expected_projection_hash_for_accept?: string | null;
      lifecycle_state_version?: number;
    };
    expect(dj.result_status).toBe("drift");
    expect(dj.expected_projection_hash_for_accept).toBe(v0.material_truth_sha256);

    const ac = await accept(
      new NextRequest("http://localhost/api/v1/enforcement/accept", {
        method: "POST",
        headers: { authorization: "Bearer wf_sk_test", "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: "r4",
          workflow_id: "wf-a",
          material_truth_sha256: v1.material_truth_sha256,
          certificate_sha256: v1.certificate_sha256,
          expected_projection_hash: dj.expected_projection_hash_for_accept,
          lifecycle_state_version: dj.lifecycle_state_version,
          outcome_certificate: v1.outcome_certificate,
          acceptance_reason: "integration test drift accept",
          acceptance_owner: "enforcement-state.integration.test",
        }),
      }),
    );
    expect(ac.status).toBe(200);
    const aj = (await ac.json()) as { lifecycle_state?: string };
    expect(aj.lifecycle_state).toBe("rerun_required");

    const pass2 = await check(mkReq("http://localhost/api/v1/enforcement/check", "r5", v1));
    expect(pass2.status).toBe(200);
    const p2 = (await pass2.json()) as { result_status?: string };
    expect(p2.result_status).toBe("rerun_pass");
  });

  it("returns rebase-required when legacy baseline flag is set", async () => {
    const legacyEnv = governanceEnvelopeFor("wf-legacy", 0);
    fsmRows.map.set("wf-legacy", {
      lifecycle: "baseline_active",
      version: 1,
      baselineHash: legacyEnv.material_truth_sha256,
      pendingAccept: null,
      needsRebaseline: true,
    });
    const { POST: check } = await import("@/app/api/v1/enforcement/check/route");
    const res = await check(
      new NextRequest("http://localhost/api/v1/enforcement/check", {
        method: "POST",
        headers: { authorization: "Bearer wf_sk_test", "content-type": "application/json" },
        body: envelopePostJson(legacyEnv, "wf-legacy", "r-legacy"),
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("ENFORCE_BASELINE_REBASE_REQUIRED");
  });
});

describe("enforcement API entitlement and quota semantics", () => {
  it("starter cannot baseline/check/accept", async () => {
    state.principal.user.plan = "starter";
    state.principal.user.subscriptionStatus = "none";
    const ent = governanceEnvelopeFor("wf-ent", 0);
    const { POST: createBaseline } = await import("@/app/api/v1/enforcement/baselines/route");
    const { POST: check } = await import("@/app/api/v1/enforcement/check/route");
    const { POST: accept } = await import("@/app/api/v1/enforcement/accept/route");
    const req = (url: string) =>
      new NextRequest(url, {
        method: "POST",
        headers: { authorization: "Bearer wf_sk_test", "content-type": "application/json" },
        body: envelopePostJson(ent, "wf-ent", "r1"),
      });
    const acceptReq = new NextRequest("http://localhost/api/v1/enforcement/accept", {
      method: "POST",
      headers: { authorization: "Bearer wf_sk_test", "content-type": "application/json" },
      body: JSON.stringify({
        schema_version: 3,
        run_id: "r1a",
        workflow_id: "wf-ent",
        material_truth_sha256: ent.material_truth_sha256,
        certificate_sha256: ent.certificate_sha256,
        expected_projection_hash: "x",
        lifecycle_state_version: 1,
        outcome_certificate: ent.outcome_certificate,
        acceptance_reason: "should not reach paid path",
        acceptance_owner: "starter-test@example.com",
      }),
    });
    for (const fn of [createBaseline, check]) {
      const res = await fn(req("http://localhost"));
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("ENFORCEMENT_REQUIRES_PAID_PLAN");
    }
    const acceptRes = await accept(acceptReq);
    expect(acceptRes.status).toBe(403);
    const abody = (await acceptRes.json()) as { code?: string };
    expect(abody.code).toBe("ENFORCEMENT_REQUIRES_PAID_PLAN");
  });

  it("inactive paid user cannot baseline/check/accept", async () => {
    state.principal.user.plan = "team";
    state.principal.user.subscriptionStatus = "inactive";
    const ent = governanceEnvelopeFor("wf-ent", 0);
    const { POST: createBaseline } = await import("@/app/api/v1/enforcement/baselines/route");
    const res = await createBaseline(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: "Bearer wf_sk_test", "content-type": "application/json" },
        body: envelopePostJson(ent, "wf-ent", "r2"),
      }),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("active paid user can baseline/check/accept and response marks quota path explicit", async () => {
    state.principal.user.plan = "team";
    state.principal.user.subscriptionStatus = "active";
    const ent = governanceEnvelopeFor("wf-ent", 0);
    const { POST: createBaseline } = await import("@/app/api/v1/enforcement/baselines/route");
    const res = await createBaseline(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: "Bearer wf_sk_test", "content-type": "application/json" },
        body: envelopePostJson(ent, "wf-ent", "r3"),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { quota_enforced_via_reserve?: boolean };
    expect(body.quota_enforced_via_reserve).toBe(true);
  });
});
