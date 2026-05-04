import * as cheerio from "cheerio";
import { describe, expect, beforeAll, it } from "vitest";
import { productCopy } from "@/content/productCopy";
import { getSecurityQuickFacts } from "@/lib/commercialNarrative";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { buildSiteFooterLegalLinks, buildSiteFooterProductLinks } from "@/lib/siteChrome";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

describe("buyer-surface HTML contracts (R2–R6)", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("footer product row order github → npm → openapi → issues → support → contact (R2)", async () => {
    const html = await getSiteHtml("/");
    const $ = cheerio.load(html);
    const hrefs = $("footer nav[aria-label='Product links'] a")
      .map((_, el) => $(el).attr("href") ?? "")
      .get();
    expect(hrefs[0]).toBe(publicProductAnchors.gitRepositoryUrl);
    expect(hrefs[1]).toBe(publicProductAnchors.npmPackageUrl);
    expect(hrefs[2]).toMatch(/openapi-commercial-v1\.yaml$/);
    expect(hrefs[3]).toBe(publicProductAnchors.bugsUrl);
    expect(hrefs[4]).toBe("/support");
    expect(hrefs[5]).toBe("/contact");
    expect(hrefs).toHaveLength(6);
  });

  it("footer legal row security → privacy → terms (R2)", async () => {
    const expected = buildSiteFooterLegalLinks().map((l) => l.href);
    const html = await getSiteHtml("/");
    const $ = cheerio.load(html);
    const hrefs = $("footer nav[aria-label='Trust and legal'] a")
      .map((_, el) => $(el).attr("href") ?? "")
      .get();
    expect(hrefs).toEqual(expected);
  });

  it("homepage closing footer has four keyed testids github → npm → docs → pricing (R3)", async () => {
    const html = await getSiteHtml("/");
    for (const key of ["github", "npm", "docs", "pricing"]) {
      expect(html).toContain(`data-testid="home-footer-${key}"`);
    }
  });

  it("/pricing shows plans grid and comparison without legacy billing band (R4)", async () => {
    const html = await getSiteHtml("/pricing");
    expect(html).not.toContain('data-testid="pricing-trust-band"');
    expect(html).toContain('data-testid="pricing-compare-section"');
    expect(html).toContain(productCopy.pricingPlansSectionTitle);
    const $ = cheerio.load(html);
    expect($('[data-plan="starter"]').length).toBe(1);
    expect($('[data-plan="enterprise"]').length).toBe(1);
  });

  it("/security quick facts match commercialNarrative (R5)", async () => {
    const qf = getSecurityQuickFacts();
    const html = await getSiteHtml("/security");
    expect(html).toContain('data-testid="security-quick-facts"');
    const $ = cheerio.load(html);
    const sec = $('[data-testid="security-quick-facts"]');
    expect(sec.find("h2").first().text().trim()).toBe(qf.title);
    const bullets = sec.find("li").toArray().map((el) => $(el).text().trim());
    for (const b of qf.bullets) {
      expect(bullets).toContain(b);
    }
  });

  it("/support issues link href is bugsUrl and headings match productCopy (R6)", async () => {
    const html = await getSiteHtml("/support");
    const $ = cheerio.load(html);
    const issues = $('[data-testid="support-issues-link"]');
    expect(issues.attr("href")).toBe(publicProductAnchors.bugsUrl);
    expect($("main h1").first().text().trim()).toBe(productCopy.supportPage.h1);
    expect($("main").text()).toContain(productCopy.supportPage.intro);
  });
});
