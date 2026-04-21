import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("pricing page", () => {
  const src = readFileSync(
    path.join(__dirname, "..", "src", "app", "pricing", "page.tsx"),
    "utf8",
  );

  it("imports productCopy for pricing hero and marketingContracts for commercial terms", () => {
    expect(src).toContain('from "@/content/productCopy"');
    expect(src).toContain('from "@/content/marketingContracts"');
    expect(src).toContain("productCopy.pricingHero");
    expect(src).toContain("PRICING_COMMERCIAL_TERMS_BULLETS");
  });
});
