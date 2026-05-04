import * as cheerio from "cheerio";
import { describe, expect, beforeAll, it } from "vitest";
import { productCopy } from "@/content/productCopy";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

describe("pricing page HTML (plans + comparison)", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("does not surface commercial terms expand or telemetry onboarding blocks", async () => {
    const html = await getSiteHtml("/pricing");
    expect(html).not.toContain('aria-label="Commercial terms"');
    expect(html).not.toContain("Full commercial terms");
    expect(html).not.toContain("First five minutes");
    expect(html).not.toContain("Telemetry and checklist details");
  });

  it("exposes hero recap, recommended Team pill, and plan comparison", async () => {
    const html = await getSiteHtml("/pricing");
    expect(html).toContain('data-testid="pricing-hero-recap"');
    expect(html).toContain('data-testid="pricing-recommended-pill"');
    expect(html).toContain(productCopy.pricingRecommendedPill);
    expect(html).toContain('data-testid="pricing-compare-section"');
    if (productCopy.pricingTeamFootnote.length > 0) {
      expect(html).toContain('data-testid="pricing-team-footnote"');
      expect(html).toContain(productCopy.pricingTeamFootnote);
    }
    const $ = cheerio.load(html);
    const recap = $('[data-testid="pricing-hero-recap"]');
    for (const pill of productCopy.trustStripPills) {
      if (typeof pill === "string") {
        expect(recap.text()).toContain(pill);
      } else {
        expect(recap.text()).toContain(pill.title);
        expect(recap.text()).toContain(pill.supporting);
      }
    }
  });
});
