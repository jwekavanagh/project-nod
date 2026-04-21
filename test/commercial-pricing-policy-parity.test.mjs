import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { readCommercialPricingLines } from "./lib/readCommercialPricingLines.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const marketingContractsPath = path.join(root, "website", "src", "content", "marketingContracts.ts");
const pricingPagePath = path.join(root, "website", "src", "app", "pricing", "page.tsx");

describe("commercial pricing policy parity", () => {
  it("server pricing surface (marketingContracts + pricing page) contains both normative lines from policy", () => {
    const lines = readCommercialPricingLines(root);
    const combined =
      readFileSync(marketingContractsPath, "utf8") + readFileSync(pricingPagePath, "utf8");
    for (const line of lines) {
      assert.ok(
        combined.includes(line),
        `pricing policy line must appear in marketingContracts.ts and/or pricing/page.tsx: ${line.slice(0, 60)}…`,
      );
    }
    assert.ok(
      combined.includes("PRICING_COMMERCIAL_TERMS_BULLETS"),
      "pricing/page.tsx must render PRICING_COMMERCIAL_TERMS_BULLETS (server commercial terms)",
    );
    assert.ok(
      combined.includes('aria-label="Commercial terms"'),
      "pricing/page.tsx must expose the Commercial terms list to HTML",
    );
  });
});
