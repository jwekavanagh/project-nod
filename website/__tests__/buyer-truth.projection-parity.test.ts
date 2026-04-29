import { describe, expect, it } from "vitest";
import buyerTruthSnap from "../src/generated/buyerTruthProjection.snap.json";
import { getCommittedBuyerFacingProjection } from "@/lib/commercialNarrative";

describe("buyer-truth projection", () => {
  it("matches committed snapshot JSON (exportBuyerFacingProjection vs buyerTruthProjection.snap.json)", () => {
    expect(getCommittedBuyerFacingProjection()).toEqual(buyerTruthSnap);
  });
});
