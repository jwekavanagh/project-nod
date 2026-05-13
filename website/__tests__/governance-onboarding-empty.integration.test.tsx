/**
 * Empty-state onboarding on /account/governance (ordered governance path).
 */
import * as cheerio from "cheerio";
import GovernancePage from "@/app/account/governance/page";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { governanceOnboardingHrefList } from "@/lib/governanceOnboardingLinks";
import marketing from "@/lib/marketing";
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

describe.skipIf(!hasDatabaseUrl)("Governance account page — empty-state onboarding", () => {
  beforeEach(async () => {
    await truncateCoreCommercialDb("governance-onboarding-empty.integration");
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders ordered governance onboarding when there are no baselines", async () => {
    const [u] = await db
      .insert(users)
      .values({
        email: "gov-onboard-empty@example.com",
        emailVerified: new Date(),
        plan: "team",
        subscriptionStatus: "active",
      })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "gov-onboard-empty@example.com", name: null },
    });

    const node = await GovernancePage();
    const html = renderToStaticMarkup(node as React.ReactElement);
    const $ = cheerio.load(html);
    expect($(`section[data-testid="governance-onboarding-empty"] h2`).text()).toBe("Get started with CI governance");
    const hrefs = $(
      `section[data-testid="governance-onboarding-empty"] ol[data-testid="governance-onboarding-steps"] li a`,
    )
      .toArray()
      .map((el) => $(el).attr("href"));
    expect(hrefs).toEqual([...governanceOnboardingHrefList(marketing.gitRepositoryUrl)]);
    expect(html).toContain("No baselines yet.");
  });
});
