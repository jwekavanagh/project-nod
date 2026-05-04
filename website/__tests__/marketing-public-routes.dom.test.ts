import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import marketing from "@/lib/marketing";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

const BANNED = /\b(crossing success|PatternComplete|IntegrateSpine|Outcome Certificate|AC-)\b/i;

function homeMainBannedScanText(html: string): string {
  const $ = cheerio.load(html);
  const $main = $("main").first();
  $main.find("script, style, noscript").remove();
  /** Trust pills name the artifact explicitly (`Outcome Certificate`). Scan the rest for internal codenames. */
  $main.find(".trust-pills").remove();
  return $main.text().replace(/\s+/g, " ").trim();
}

describe("marketing public route DOM invariants", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("home main has no banned tokens in visible hero text (JSON + DOM)", () => {
    const root = getRepoRoot();
    const raw = JSON.parse(
      readFileSync(join(root, "config", "marketing.json"), "utf8"),
    ) as { heroOutcome: string; heroMechanism: string };
    expect(BANNED.test(String(raw.heroOutcome))).toBe(false);
    expect(BANNED.test(String(raw.heroMechanism))).toBe(false);
  });

  it("home rendered main has no banned substrings", async () => {
    const html = await getSiteHtml("/");
    const text = homeMainBannedScanText(html);
    expect(BANNED.test(text)).toBe(false);
  });

  it("integrate has truth-check pre and GitHub doc link", async () => {
    const html = await getSiteHtml("/integrate");
    const $ = cheerio.load(html);
    const $main = $("main.integrate-main");
    const $truthPre = $main.find('[data-testid="integrate-truth-check-commands"]');
    expect($truthPre.length).toBe(1);
    const truthNorm = $truthPre.text().replace(/\s+/g, " ");
    const checkNorm = marketing.integratePage.truthCheckCommand.replace(/\s+/g, " ").trim();
    expect(truthNorm).toContain(checkNorm);
    expect($main.find("section.integrate-optional-spine").length).toBe(0);
    expect($main.find("details").length).toBe(0);
    const gh = $main.find('a[href^="https://github.com/"]');
    expect(gh.length).toBeGreaterThanOrEqual(1);
    const hrefs = gh
      .toArray()
      .map((el) => $(el).attr("href"))
      .filter(Boolean) as string[];
    expect(
      hrefs.some((h) => {
        try {
          return new URL(h).hostname === "github.com";
        } catch {
          return false;
        }
      }),
    ).toBe(true);
  });
});
