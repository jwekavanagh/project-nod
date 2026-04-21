import { METERING_CLARIFIER } from "@/content/marketingContracts";
import { productCopy } from "@/content/productCopy";
import { describe, expect, it } from "vitest";

describe("commercialSurface contract", () => {
  it("lead is the metering clarifier from marketingContracts", () => {
    expect(productCopy.commercialSurface.lead).toBe(METERING_CLARIFIER);
  });
});
