import { HOME_SECTION_ORDER } from "@/app/page.sections";
import { describe, expect, it } from "vitest";

describe("HOME_SECTION_ORDER", () => {
  it("matches conversion funnel order (seven sections)", () => {
    expect([...HOME_SECTION_ORDER]).toEqual([
      "hero",
      "homeWhatCatches",
      "homeStakes",
      "howItWorks",
      "fitAndLimits",
      "homeClosing",
      "commercialSurface",
    ]);
    expect(HOME_SECTION_ORDER.length).toBe(7);
  });

  it("orders hero through commercialSurface monotonically", () => {
    const he = HOME_SECTION_ORDER.indexOf("hero");
    const wc = HOME_SECTION_ORDER.indexOf("homeWhatCatches");
    const st = HOME_SECTION_ORDER.indexOf("homeStakes");
    const hw = HOME_SECTION_ORDER.indexOf("howItWorks");
    const fl = HOME_SECTION_ORDER.indexOf("fitAndLimits");
    const cl = HOME_SECTION_ORDER.indexOf("homeClosing");
    const cs = HOME_SECTION_ORDER.indexOf("commercialSurface");
    expect(he).toBeLessThan(wc);
    expect(wc).toBeLessThan(st);
    expect(st).toBeLessThan(hw);
    expect(hw).toBeLessThan(fl);
    expect(fl).toBeLessThan(cl);
    expect(cl).toBeLessThan(cs);
  });

  it("excludes pricing", () => {
    expect(HOME_SECTION_ORDER).not.toContain("pricing");
  });
});
