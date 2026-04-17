import { productCopy } from "@/content/productCopy";
import { describe, expect, it } from "vitest";

const EXPECTED_LEAD =
  "Open-source covers local verification without a site API key. Paid plans add licensed npm, monthly quota, and API keys for CI and production—Stripe checkout on Pricing. Machine-readable contracts stay on this site.";

describe("commercialSurface contract", () => {
  it("lead is verbatim and within max length", () => {
    expect(productCopy.commercialSurface.lead).toBe(EXPECTED_LEAD);
    expect(productCopy.commercialSurface.lead.length).toBeLessThanOrEqual(220);
  });
});
