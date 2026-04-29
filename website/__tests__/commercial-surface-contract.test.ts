import { describe, expect, it } from "vitest";
import {
  getHomeCommercialLead,
  getHomeCommercialSectionFromConfig,
  HOME_COMMERCIAL_BOUNDARY_DOCS,
} from "@/lib/commercialNarrative";

describe("commercial surface contract", () => {
  it("home commercial uses lede, empty strip, and boundary link metadata", () => {
    const s = getHomeCommercialSectionFromConfig();
    expect(s.lead).toBe(getHomeCommercialLead());
    expect(s.strip).toBe("");
    expect(s.title).toBe("Open source and commercial");
    expect(HOME_COMMERCIAL_BOUNDARY_DOCS.label).toBe("See the commercial boundary docs.");
    expect(HOME_COMMERCIAL_BOUNDARY_DOCS.href).toMatch(/docs\/commercial\.md/);
  });
});
