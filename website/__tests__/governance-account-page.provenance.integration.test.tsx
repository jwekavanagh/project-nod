/**
 * Governance baseline provenance: SSR HTML includes joined evidence run kind; no legacy "n/a" baseline run placeholders.
 */
import GovernancePage from "@/app/account/governance/page";
import { db } from "@/db/client";
import { enforcementBaselines, governanceEvidence, users } from "@/db/schema";
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

describe.skipIf(!hasDatabaseUrl)("Governance SSR baseline provenance", () => {
  beforeEach(async () => {
    await truncateCoreCommercialDb("governance-account-page.provenance.integration");
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("baseline_run_kind contract_sql via governance_evidence join; no naive baseline_run n/a", async () => {
    const wf = `wf_prov_${crypto.randomUUID().slice(0, 8)}`;
    const cert = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cert.workflowId = wf;

    const [u] = await db
      .insert(users)
      .values({ email: "gov-ssr-prov@example.com", emailVerified: new Date(), plan: "team", subscriptionStatus: "active" })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "gov-ssr-prov@example.com", name: null },
    });

    const [ge] = await db
      .insert(governanceEvidence)
      .values({
        userId: u!.id,
        workflowId: wf,
        runId: "baseline-run-prov-1",
        certificateJson: cert as unknown as Record<string, unknown>,
        certificateSha256: canonicalCertificateSha256(cert),
        materialTruthJson: materialTruthProjectionFromCertificate(cert) as unknown as Record<string, unknown>,
        materialTruthSha256: materialTruthSha256(cert),
      })
      .returning();

    await db.insert(enforcementBaselines).values({
      userId: u!.id,
      workflowId: wf,
      projectionHash: materialTruthSha256(cert),
      projection: {},
      baselineEvidenceId: ge!.id,
    });

    const node = await GovernancePage();
    const html = renderToStaticMarkup(node as React.ReactElement);
    expect(html).toContain("baseline_run_kind");
    expect(html).toContain("contract_sql");
    expect(html).not.toContain("baseline_run_id:</strong> n/a");
    expect(html).toContain(wf);
  });
});
