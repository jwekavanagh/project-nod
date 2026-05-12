/**
 * Export nests governedAcceptance on FSM transitions when metadata carries acceptance_id / governed_acceptance_id.
 */
import { GET as getExport } from "@/app/api/v1/governance/export/route";
import { db } from "@/db/client";
import {
  enforcementFsmTransition,
  governanceAcceptance,
  governanceEvidence,
  users,
} from "@/db/schema";
import type { OutcomeCertificateV1 } from "agentskeptic";
import {
  canonicalCertificateSha256,
  materialTruthProjectionFromCertificate,
  materialTruthSha256,
} from "agentskeptic/governanceEvidence";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
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

describe.skipIf(!hasDatabaseUrl)("governance export governedAcceptance nesting", () => {
  beforeEach(async () => {
    await truncateCoreCommercialDb("governance-export-governed.integration");
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fsmTransitions include governedAcceptance joined from metadata.acceptance_id", async () => {
    const wf = `wf_expnest_${crypto.randomUUID().slice(0, 8)}`;
    const cert = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cert.workflowId = wf;

    const [u] = await db
      .insert(users)
      .values({
        email: "gov-export-nest@example.com",
        emailVerified: new Date(),
        plan: "team",
        subscriptionStatus: "active",
      })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "gov-export-nest@example.com", name: null },
    });

    const [ge] = await db
      .insert(governanceEvidence)
      .values({
        userId: u!.id,
        workflowId: wf,
        runId: "run-ev-1",
        certificateJson: cert as unknown as Record<string, unknown>,
        certificateSha256: canonicalCertificateSha256(cert),
        materialTruthJson: materialTruthProjectionFromCertificate(cert) as unknown as Record<string, unknown>,
        materialTruthSha256: materialTruthSha256(cert),
      })
      .returning();

    const [acc] = await db
      .insert(governanceAcceptance)
      .values({
        userId: u!.id,
        workflowId: wf,
        runId: "run-acc-1",
        evidenceId: ge!.id,
        acceptanceReason: "Ticket 42",
        acceptanceOwner: "owner-export-test@example.com",
        acceptedMaterialTruthSha256: materialTruthSha256(cert),
      })
      .returning();

    await db.insert(enforcementFsmTransition).values({
      userId: u!.id,
      workflowId: wf,
      runId: "run-tr-1",
      eventKind: "accept_drift",
      fromState: "action_required",
      toState: "rerun_required",
      lifecycleStateVersionAfter: 2,
      expectedProjectionHash: "pin",
      actualProjectionHash: materialTruthSha256(cert),
      evidenceId: ge!.id,
      metadata: { acceptance_id: acc!.id, attempt_id: "a1" },
    });

    const res = await getExport(
      new NextRequest(`http://localhost/api/v1/governance/export?workflow_id=${encodeURIComponent(wf)}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      fsmTransitions: Array<{ governedAcceptance?: { acceptanceOwner?: string } | null }>;
    };
    expect(body.fsmTransitions).toHaveLength(1);
    expect(body.fsmTransitions[0]!.governedAcceptance?.acceptanceOwner).toBe("owner-export-test@example.com");
  });
});
