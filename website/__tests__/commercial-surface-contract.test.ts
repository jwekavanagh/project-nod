import { describe, expect, it } from "vitest";
import {
  getHomeCommercialSectionFromConfig,
  HOME_COMMERCIAL_FOLLOW,
  HOME_COMMERCIAL_LEAD,
} from "@/lib/commercialNarrative";

describe("commercial surface contract", () => {
  it("home commercial uses short lede and follow line with commercial SSOT reference", () => {
    const s = getHomeCommercialSectionFromConfig();
    expect(s.lead).toBe(HOME_COMMERCIAL_LEAD);
    expect(s.strip).toBe(HOME_COMMERCIAL_FOLLOW);
    expect(s.title).toBe("Open source and commercial");
    expect(s.strip).toMatch(/docs\/commercial\.md/);
  });
});
