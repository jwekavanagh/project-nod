import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docPath = join(__dirname, "..", "..", "docs", "growth-metrics.md");

const DENY_SUBSTRINGS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "landing_path",
  "referrer_path",
  "512",
] as const;

describe("growth-metrics-doc-boundary", () => {
  it("growth-metrics does not embed attribution-contract literals", () => {
    const md = readFileSync(docPath, "utf8");
    for (const s of DENY_SUBSTRINGS) {
      expect(md.includes(s), `unexpected substring in growth SSOT: ${s}`).toBe(false);
    }
  });
});
