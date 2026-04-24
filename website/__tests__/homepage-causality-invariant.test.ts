import * as cheerio from "cheerio";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, beforeAll, it } from "vitest";
import { productCopy } from "@/content/productCopy";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  getSiteHtml,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";

registerMarketingSiteTeardown();

function mainVisibleText(html: string): string {
  const $ = cheerio.load(html);
  const $main = $("main").first().clone();
  $main.find("script, style, noscript").remove();
  return $main.text().replace(/\s+/g, " ").trim();
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

describe("homepage causality invariant", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    await ensureMarketingSiteRunning();
  });

  it("exactly one canonical not-guaranteed sentence in main visible text; full visitor block absent; mechanism copy static rules", async () => {
    const root = getRepoRoot();
    const discoveryPath = join(root, "config", "marketing.json");
    const disc = JSON.parse(readFileSync(discoveryPath, "utf8")) as {
      visitorProblemAnswer: string;
    };

    const html = await getSiteHtml("/");
    const visible = mainVisibleText(html);
    const sentence = productCopy.guarantees.notGuaranteed[0];
    expect(countOccurrences(visible, sentence)).toBe(1);

    // Forbid the full multi-paragraph visitor block in `<main>` when JSON has more than one paragraph.
    expect(visible.includes(disc.visitorProblemAnswer)).toBe(false);
    const paragraphs = disc.visitorProblemAnswer.split(/\n\n+/).filter(Boolean);
    if (paragraphs.length > 1) {
      const secondPara = paragraphs[1] ?? "";
      const tailPara = paragraphs[paragraphs.length - 1] ?? "";
      // Short middle paragraphs are allowed (e.g. a one-line hook); guard leaks using the last long block.
      if (secondPara.length <= 40 && paragraphs.length >= 3) {
        expect(tailPara.length).toBeGreaterThan(40);
        expect(visible.includes(tailPara.slice(0, 120))).toBe(false);
      } else {
        expect(secondPara.length).toBeGreaterThan(40);
        expect(visible.includes(secondPara.slice(0, 120))).toBe(false);
      }
    }

    const mech = productCopy.mechanism.notObservability;
    expect(mech.toLowerCase()).not.toContain("causal");
    expect(mech.toLowerCase()).not.toContain("not proof");

    expect(disc.visitorProblemAnswer.toLowerCase()).not.toContain("causality");
  });
});
