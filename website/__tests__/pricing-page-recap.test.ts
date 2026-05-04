import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("pricing page", () => {
  const src = readFileSync(
    path.join(__dirname, "..", "src", "app", "pricing", "page.tsx"),
    "utf8",
  );

  it("imports commercialNarrative for the pricing view model and productCopy for remaining chrome", () => {
    expect(src).toContain('from "@/content/productCopy"');
    expect(src).toContain('from "@/lib/commercialNarrative"');
    expect(src).toContain("getPricingPageViewModelFromConfig");
    expect(src).toContain("PricingCompareTable");
    expect(src).toContain("TrustPills");
  });
});
