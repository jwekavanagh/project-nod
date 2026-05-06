/**
 * T1: authenticated POST /enforcement/baselines persists governance_evidence with core certificate hash.
 */
import { POST as postBaselines } from "@/app/api/v1/enforcement/baselines/route";
import { POST as postCreateKey } from "@/app/api/account/create-key/route";
import { canonicalCertificateSha256, materialTruthSha256 } from "agentskeptic/governanceEvidence";
import type { OutcomeCertificateV1 } from "agentskeptic";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
import { db } from "@/db/client";
import { governanceEvidence, users } from "@/db/schema";
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

describe.skipIf(!hasDatabaseUrl)("hosted governance evidence DB integration", () => {
  beforeEach(async () => {
    await truncateCoreCommercialDb("hosted-governance-evidence.integration");
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("T1-valid-hosted-v3-envelope", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "hosted-gov-t1@example.com", emailVerified: new Date(), plan: "team", subscriptionStatus: "active" })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "hosted-gov-t1@example.com", name: null },
    });
    const keyRes = await postCreateKey();
    expect(keyRes.status).toBe(200);
    const { apiKey } = (await keyRes.json()) as { apiKey: string };

    const workflowId = `wf_t1_${crypto.randomUUID().slice(0, 8)}`;
    const runId = crypto.randomUUID();
    const cert = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cert.workflowId = workflowId;

    const certificate_sha256 = canonicalCertificateSha256(cert);
    const material_truth_sha256 = materialTruthSha256(cert);

    const res = await postBaselines(
      new NextRequest("http://localhost/api/v1/enforcement/baselines", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: 3,
          run_id: runId,
          workflow_id: workflowId,
          material_truth_sha256,
          certificate_sha256,
          outcome_certificate: cert,
        }),
      }),
    );
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(governanceEvidence)
      .where(and(eq(governanceEvidence.userId, u!.id), eq(governanceEvidence.workflowId, workflowId), eq(governanceEvidence.runId, runId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.certificateSha256).toBe(canonicalCertificateSha256(cert));
  });
});
