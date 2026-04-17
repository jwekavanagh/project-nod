import { productCopy } from "@/content/productCopy";
import discoveryAcquisition from "@/lib/discoveryAcquisition";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";
import * as cheerio from "cheerio";
import { describe, expect, beforeAll, it } from "vitest";

registerMarketingSiteTeardown();

function normWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function mainText(html: string): string {
  const $ = cheerio.load(html);
  return normWs($("main").text());
}

describe("home vs brief exclusive content", { timeout: 180_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("matrix A/B/C", async () => {
    const home = await getSiteHtml("/");
    const brief = await getSiteHtml(discoveryAcquisition.slug);
    const homeText = mainText(home);
    const briefText = mainText(brief);

    const disc = discoveryAcquisition;
    const visitor = disc.visitorProblemAnswer;
    const visitorNorm = normWs(
      visitor
        .split(/\n\n+/)
        .map((p) => p.trim())
        .join(""),
    );
    const transcriptNeedle = "### Success (`wf_complete`)";

    for (const h of disc.sections) {
      expect(briefText).toContain(h.heading);
      expect(homeText).not.toContain(h.heading);
    }

    expect(briefText).toContain(visitorNorm);
    expect(homeText).not.toContain(visitorNorm);

    expect(brief).toContain(transcriptNeedle);
    expect(homeText).not.toContain(transcriptNeedle);

    expect(briefText).toContain(disc.heroSubtitle);
    expect(homeText).not.toContain(disc.heroSubtitle);

    expect(briefText).toContain(productCopy.acquisitionDeepContextSectionTitle);
    expect(homeText).not.toContain(productCopy.acquisitionDeepContextSectionTitle);

    expect(briefText).toContain(disc.homepageHero.why);
    expect(briefText).toContain(disc.homepageHero.what);
    expect(briefText).toContain(disc.homepageHero.when);
    expect(homeText).not.toContain(disc.homepageHero.why);
    expect(homeText).not.toContain(disc.homepageHero.what);
    expect(homeText).not.toContain(disc.homepageHero.when);

    expect(home).toContain('data-testid="home-try-it"');
    expect(brief).not.toContain('data-testid="home-try-it"');

    expect(homeText).toContain(productCopy.homeStakes.sectionTitle);
    expect(briefText).not.toContain(productCopy.homeStakes.sectionTitle);

    const navPrimary = home.indexOf('aria-label="Primary"');
    expect(navPrimary).toBeGreaterThanOrEqual(0);
    const navSlice = home.slice(navPrimary, navPrimary + 4000);
    expect(navSlice).not.toContain('href="/security"');
    expect(navSlice).not.toContain('href="/examples"');
  });
});
