/**
 * Governed commercial acceptance + check pass_kind (real Postgres).
 */
import { POST as postAccept } from "@/app/api/v1/enforcement/accept/route";
import { POST as postBaselines } from "@/app/api/v1/enforcement/baselines/route";
import { POST as postCheck } from "@/app/api/v1/enforcement/check/route";
import { GET as getHistory } from "@/app/api/v1/enforcement/history/route";
import { POST as postCreateKey } from "@/app/api/account/create-key/route";
import { canonicalCertificateSha256, materialTruthSha256 } from "agentskeptic/governanceEvidence";
import type { OutcomeCertificateV1 } from "agentskeptic";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
import { db } from "@/db/client";
import { enforcementBaselines, governanceAcceptance, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { truncateCoreCommercialDb } from "./helpers/truncateCommercialFixture";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

type AuthMock = { mockReset(): void; mockResolvedValue(value: unknown): void };
const authMock = auth as unknown as AuthMock;

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

function envelopeFor(workflowId: string, driftVariant: number) {
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

describe.skipIf(!hasDatabaseUrl)("governed enforcement acceptance integration", () => {
  beforeEach(async () => {
    await truncateCoreCommercialDb("governed-acceptance.integration");
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects accept without acceptance_reason (400)", async () => {
    const [u] = await db
      .insert(users)
      .values({
        email: "gov-acc-400@example.com",
        emailVerified: new Date(),
        plan: "team",
        subscriptionStatus: "active",
      })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "gov-acc-400@example.com", name: null },
    });
    const keyRes = await postCreateKey();
    expect(keyRes.status).toBe(200);
    const { apiKey } = (await keyRes.json()) as { apiKey: string };

    const workflowId = `wf_400_${crypto.randomUUID().slice(0, 8)}`;
    const e0 = envelopeFor(workflowId, 0);
    const runB = crypto.randomUUID();
    const baseRes = await postBaselines(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runB,
          workflow_id: workflowId,
          material_truth_sha256: e0.material_truth_sha256,
          certificate_sha256: e0.certificate_sha256,
          outcome_certificate: e0.outcome_certificate,
        }),
      }),
    );
    expect(baseRes.status).toBe(200);

    const e1 = envelopeFor(workflowId, 1);
    const runC = crypto.randomUUID();
    const driftCheck = await postCheck(
      new NextRequest("http://localhost/api/v1/enforcement/check", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runC,
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
        }),
      }),
    );
    expect(driftCheck.status).toBe(200);
    const driftJson = (await driftCheck.json()) as {
      expected_projection_hash_for_accept: string;
      lifecycle_state_version: number;
    };

    const runA = crypto.randomUUID();
    const bodyMissingReason = {
      schema_version: 3,
      run_id: runA,
      workflow_id: workflowId,
      material_truth_sha256: e1.material_truth_sha256,
      certificate_sha256: e1.certificate_sha256,
      outcome_certificate: e1.outcome_certificate,
      expected_projection_hash: driftJson.expected_projection_hash_for_accept,
      lifecycle_state_version: driftJson.lifecycle_state_version,
      acceptance_owner: "ops@example.com",
    };
    const res = await postAccept(
      new NextRequest("http://localhost/api/v1/enforcement/accept", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(bodyMissingReason),
      }),
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { message?: string };
    expect(String(j.message)).toContain("acceptance_reason");
  });

  it("persists governance_acceptance, RERUN_PASS emits governed pass_kind then baseline_match", async () => {
    const [u] = await db
      .insert(users)
      .values({
        email: "gov-acc-flow@example.com",
        emailVerified: new Date(),
        plan: "team",
        subscriptionStatus: "active",
      })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "gov-acc-flow@example.com", name: null },
    });
    const keyRes = await postCreateKey();
    expect(keyRes.status).toBe(200);
    const { apiKey } = (await keyRes.json()) as { apiKey: string };

    const workflowId = `wf_flow_${crypto.randomUUID().slice(0, 8)}`;
    const e0 = envelopeFor(workflowId, 0);
    const runBaseline = crypto.randomUUID();
    const baseRes = await postBaselines(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runBaseline,
          workflow_id: workflowId,
          material_truth_sha256: e0.material_truth_sha256,
          certificate_sha256: e0.certificate_sha256,
          outcome_certificate: e0.outcome_certificate,
        }),
      }),
    );
    expect(baseRes.status).toBe(200);

    const e1 = envelopeFor(workflowId, 1);
    const runDriftCheck = crypto.randomUUID();
    const driftCheck = await postCheck(
      new NextRequest("http://localhost/api/v1/enforcement/check", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runDriftCheck,
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
        }),
      }),
    );
    expect(driftCheck.status).toBe(200);
    const driftJson = (await driftCheck.json()) as {
      expected_projection_hash_for_accept: string;
      lifecycle_state_version: number;
    };

    const runAccept = crypto.randomUUID();
    const owner = "release-manager@example.com";
    const acceptRes = await postAccept(
      new NextRequest("http://localhost/api/v1/enforcement/accept", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runAccept,
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
          expected_projection_hash: driftJson.expected_projection_hash_for_accept,
          lifecycle_state_version: driftJson.lifecycle_state_version,
          acceptance_reason: "Migration window approved",
          acceptance_owner: owner,
          evidence_links: ["https://example.com/ticket/1"],
          exception_review_by: "2035-01-01T00:00:00.000Z",
        }),
      }),
    );
    expect(acceptRes.status).toBe(200);
    const acceptJson = (await acceptRes.json()) as { acceptance_id?: string };
    expect(acceptJson.acceptance_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const accRows = await db
      .select()
      .from(governanceAcceptance)
      .where(and(eq(governanceAcceptance.userId, u!.id), eq(governanceAcceptance.workflowId, workflowId)));
    expect(accRows).toHaveLength(1);
    expect(accRows[0]!.acceptanceOwner).toBe(owner);
    expect(accRows[0]!.acceptanceReason).toBe("Migration window approved");

    const [blAfterAccept] = await db
      .select()
      .from(enforcementBaselines)
      .where(and(eq(enforcementBaselines.userId, u!.id), eq(enforcementBaselines.workflowId, workflowId)));
    expect(blAfterAccept!.activeAcceptanceId).toBe(accRows[0]!.id);

    const histRes = await getHistory(
      new NextRequest(
        `http://localhost/api/v1/enforcement/history?workflow_id=${encodeURIComponent(workflowId)}`,
        { headers: { authorization: `Bearer ${apiKey}` } },
      ),
    );
    expect(histRes.status).toBe(200);
    const histJson = (await histRes.json()) as {
      acceptances?: Array<{ acceptanceOwner?: string; acceptanceReason?: string }>;
    };
    expect(histJson.acceptances).toHaveLength(1);
    expect(histJson.acceptances![0]!.acceptanceOwner).toBe(owner);
    expect(histJson.acceptances![0]!.acceptanceReason).toBe("Migration window approved");

    const runRerunPass = crypto.randomUUID();
    const rerunCheck = await postCheck(
      new NextRequest("http://localhost/api/v1/enforcement/check", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runRerunPass,
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
        }),
      }),
    );
    expect(rerunCheck.status).toBe(200);
    const rerunJson = (await rerunCheck.json()) as {
      pass_kind?: string;
      governed_acceptance_id?: string;
      decision_reason_code?: string;
    };
    expect(rerunJson.decision_reason_code).toBe("RERUN_PASS");
    expect(rerunJson.pass_kind).toBe("governed_acceptance_active");
    expect(rerunJson.governed_acceptance_id).toBe(accRows[0]!.id);

    const [blAfterPass] = await db
      .select()
      .from(enforcementBaselines)
      .where(and(eq(enforcementBaselines.userId, u!.id), eq(enforcementBaselines.workflowId, workflowId)));
    expect(blAfterPass!.activeAcceptanceId).toBeNull();

    const runSteady = crypto.randomUUID();
    const steadyCheck = await postCheck(
      new NextRequest("http://localhost/api/v1/enforcement/check", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runSteady,
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
        }),
      }),
    );
    expect(steadyCheck.status).toBe(200);
    const steadyJson = (await steadyCheck.json()) as {
      pass_kind?: string;
      governed_acceptance_id?: string;
      decision_reason_code?: string;
    };
    expect(steadyJson.decision_reason_code).toBe("CHECK_MATCH");
    expect(steadyJson.pass_kind).toBe("baseline_match");
    expect(steadyJson.governed_acceptance_id).toBeUndefined();
  });

  it("expired exception_review_by yields 409 ENFORCE_BASELINE_REBASE_REQUIRED and clears pointer", async () => {
    const [u] = await db
      .insert(users)
      .values({
        email: "gov-acc-exp@example.com",
        emailVerified: new Date(),
        plan: "team",
        subscriptionStatus: "active",
      })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "gov-acc-exp@example.com", name: null },
    });
    const keyRes = await postCreateKey();
    expect(keyRes.status).toBe(200);
    const { apiKey } = (await keyRes.json()) as { apiKey: string };

    const workflowId = `wf_exp_${crypto.randomUUID().slice(0, 8)}`;
    const e0 = envelopeFor(workflowId, 0);
    await postBaselines(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: crypto.randomUUID(),
          workflow_id: workflowId,
          material_truth_sha256: e0.material_truth_sha256,
          certificate_sha256: e0.certificate_sha256,
          outcome_certificate: e0.outcome_certificate,
        }),
      }),
    );

    const e1 = envelopeFor(workflowId, 1);
    const driftCheck = await postCheck(
      new NextRequest("http://localhost/api/v1/enforcement/check", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: crypto.randomUUID(),
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
        }),
      }),
    );
    const driftJson = (await driftCheck.json()) as {
      expected_projection_hash_for_accept: string;
      lifecycle_state_version: number;
    };

    await postAccept(
      new NextRequest("http://localhost/api/v1/enforcement/accept", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: crypto.randomUUID(),
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
          expected_projection_hash: driftJson.expected_projection_hash_for_accept,
          lifecycle_state_version: driftJson.lifecycle_state_version,
          acceptance_reason: "Temporary",
          acceptance_owner: "ops@example.com",
          exception_review_by: "2035-06-01T00:00:00.000Z",
        }),
      }),
    );

    const [acc] = await db
      .select({ id: governanceAcceptance.id })
      .from(governanceAcceptance)
      .where(and(eq(governanceAcceptance.userId, u!.id), eq(governanceAcceptance.workflowId, workflowId)))
      .limit(1);
    await db
      .update(governanceAcceptance)
      .set({ exceptionReviewBy: new Date("2019-01-01T00:00:00.000Z") })
      .where(eq(governanceAcceptance.id, acc!.id));

    const expiredCheck = await postCheck(
      new NextRequest("http://localhost/api/v1/enforcement/check", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: crypto.randomUUID(),
          workflow_id: workflowId,
          material_truth_sha256: e1.material_truth_sha256,
          certificate_sha256: e1.certificate_sha256,
          outcome_certificate: e1.outcome_certificate,
        }),
      }),
    );
    expect(expiredCheck.status).toBe(409);
    const exJ = (await expiredCheck.json()) as { code?: string };
    expect(exJ.code).toBe("ENFORCE_BASELINE_REBASE_REQUIRED");

    const [bl] = await db
      .select()
      .from(enforcementBaselines)
      .where(and(eq(enforcementBaselines.userId, u!.id), eq(enforcementBaselines.workflowId, workflowId)));
    expect(bl!.needsRebaseline).toBe(true);
    expect(bl!.activeAcceptanceId).toBeNull();
  });
});
