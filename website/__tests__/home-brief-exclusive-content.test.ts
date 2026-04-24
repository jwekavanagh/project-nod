import { productBriefPage, productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
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

describe("home vs brief exclusive content", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("matrix: brief has visitor+terminal+sections; home has stakes+tryit", async () => {
    const home = await getSiteHtml("/");
    const brief = await getSiteHtml(marketing.slug);
    const homeText = mainText(home);
    const briefText = mainText(brief);

    const visitor = marketing.visitorProblemAnswer;
    const visitorNorm = normWs(
      visitor
        .split(/\n\n+/)
        .map((p) => p.trim())
        .join(""),
    );
    const transcriptNeedle = "### Success (`wf_complete`)";

    for (const s of productCopy.productBriefPage.sections) {
      expect(briefText).toContain(s.title);
      expect(homeText).not.toContain(s.title);
    }
    for (const line of productBriefPage.terminal.intro) {
      const norm = normWs(line);
      if (norm.length < 4) {
        throw new Error("product brief terminal intro line too short for exclusivity");
      }
      expect(briefText).toContain(norm);
      expect(homeText).not.toContain(norm);
    }

    expect(briefText).toContain(visitorNorm);
    expect(homeText).not.toContain(visitorNorm);

    expect(brief).toContain(transcriptNeedle);
    expect(homeText).not.toContain(transcriptNeedle);

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
