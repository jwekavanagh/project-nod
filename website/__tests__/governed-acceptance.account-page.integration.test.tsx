/**
 * Account governance page lists governed acceptance rows (reason, owner, links).
 */
import GovernancePage from "@/app/account/governance/page";
import { db } from "@/db/client";
import { governanceAcceptance, governanceEvidence, users } from "@/db/schema";
import type { OutcomeCertificateV1 } from "agentskeptic";
import {
  canonicalCertificateSha256,
  materialTruthProjectionFromCertificate,
  materialTruthSha256,
} from "agentskeptic/governanceEvidence";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { truncateCoreCommercialDb } from "./helpers/truncateCommercialFixture";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: function MockLink(props: { href: string; children: React.ReactNode }) {
    return <a href={props.href}>{props.children}</a>;
  },
}));

import { auth } from "@/auth";

type AuthMock = { mockReset(): void; mockResolvedValue(value: unknown): void };
const authMock = auth as unknown as AuthMock;

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDatabaseUrl)("Governance account page — governed acceptances", () => {
  beforeEach(async () => {
    await truncateCoreCommercialDb("governed-acceptance.account-page.integration");
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders acceptance_reason and acceptance_owner from governance_acceptance", async () => {
    const wf = `wf_accgov_${crypto.randomUUID().slice(0, 8)}`;
    const cert = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cert.workflowId = wf;

    const [u] = await db
      .insert(users)
      .values({
        email: "gov-acc-accept@example.com",
        emailVerified: new Date(),
        plan: "team",
        subscriptionStatus: "active",
      })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "gov-acc-accept@example.com", name: null },
    });

    const [ge] = await db
      .insert(governanceEvidence)
      .values({
        userId: u!.id,
        workflowId: wf,
        runId: "run-page-1",
        certificateJson: cert as unknown as Record<string, unknown>,
        certificateSha256: canonicalCertificateSha256(cert),
        materialTruthJson: materialTruthProjectionFromCertificate(cert) as unknown as Record<string, unknown>,
        materialTruthSha256: materialTruthSha256(cert),
      })
      .returning();

    await db.insert(governanceAcceptance).values({
      userId: u!.id,
      workflowId: wf,
      runId: "run-page-acc",
      evidenceId: ge!.id,
      acceptanceReason: "DB-seeded acceptance for UI test",
      acceptanceOwner: "rtl-owner@example.com",
      evidenceLinks: ["https://example.com/ticket/99"],
      acceptedMaterialTruthSha256: materialTruthSha256(cert),
    });

    const node = await GovernancePage();
    const html = renderToStaticMarkup(node as React.ReactElement);
    expect(html).toContain("Governed acceptances");
    expect(html).toContain("DB-seeded acceptance for UI test");
    expect(html).toContain("rtl-owner@example.com");
    expect(html).toContain("https://example.com/ticket/99");
  });
});
