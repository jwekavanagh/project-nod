import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, beforeAll, it } from "vitest";
import { getPricingCommercialTermsBullets } from "@/lib/commercialNarrative";
import { productCopy } from "@/content/productCopy";
import type { CommercialPlansFile } from "@/lib/plans";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

const catalog: CommercialPlansFile = JSON.parse(
  readFileSync(join(getRepoRoot(), "config", "commercial-plans.json"), "utf8"),
) as CommercialPlansFile;
const PRICING_COMMERCIAL_TERMS_BULLETS = getPricingCommercialTermsBullets(catalog);

describe("pricing commercial terms HTML", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("main ul lists bullets with one strong per li (lead first, body in text)", async () => {
    const html = await getSiteHtml("/pricing");
    const $ = cheerio.load(html);
    const $ul = $("main ul[aria-label='Commercial terms']");
    expect($ul.length).toBe(1);
    const $lis = $ul.find("> li");
    expect($lis.length).toBe(PRICING_COMMERCIAL_TERMS_BULLETS.length);
    for (let i = 0; i < $lis.length; i++) {
      const $li = $lis.eq(i);
      const row = PRICING_COMMERCIAL_TERMS_BULLETS[i]!;
      const $strongs = $li.find("strong");
      expect($strongs.length).toBe(1);
      const first = $li.contents().first();
      expect(first.is("strong")).toBe(true);
      expect($strongs.first().text().trim()).toBe(row.lead);
      const liText = $li.text().replace(/\s+/g, " ").trim();
      expect(liText).toContain(row.body);
    }
  });

  it("exposes buyer-led recap, plan-choice guide, normative lines, and Team guidance", async () => {
    const html = await getSiteHtml("/pricing");
    expect(html).toContain('data-testid="pricing-hero-recap"');
    expect(html).toContain('data-testid="pricing-plan-choice-guide"');
    expect(html).toContain('data-testid="pricing-recommended-pill"');
    expect(html).toContain(productCopy.pricingRecommendedPill);
    if (productCopy.pricingTeamFootnote.length > 0) {
      expect(html).toContain('data-testid="pricing-team-footnote"');
      expect(html).toContain(productCopy.pricingTeamFootnote);
    }
    for (const row of PRICING_COMMERCIAL_TERMS_BULLETS) {
      expect(html).toContain(row.body);
    }
  });
});
