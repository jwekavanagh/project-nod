import { HOME_SECTION_ORDER } from "@/app/page.sections";
import { describe, expect, it } from "vitest";

describe("HOME_SECTION_ORDER", () => {
  it("matches conversion funnel order", () => {
    expect([...HOME_SECTION_ORDER]).toEqual([
      "hero",
      "coldProof",
      "scenario",
      "mechanism",
      "qualification",
      "guarantees",
      "example",
      "tryIt",
      "commercialSurface",
      "nextSteps",
    ]);
  });

  it("places coldProof after hero and before scenario", () => {
    const he = HOME_SECTION_ORDER.indexOf("hero");
    const cp = HOME_SECTION_ORDER.indexOf("coldProof");
    const sc = HOME_SECTION_ORDER.indexOf("scenario");
    expect(he).toBeLessThan(cp);
    expect(cp).toBeLessThan(sc);
  });

  it("places tryIt before commercialSurface and nextSteps; example before tryIt", () => {
    const ex = HOME_SECTION_ORDER.indexOf("example");
    const tr = HOME_SECTION_ORDER.indexOf("tryIt");
    const cs = HOME_SECTION_ORDER.indexOf("commercialSurface");
    const nx = HOME_SECTION_ORDER.indexOf("nextSteps");
    expect(ex).toBeLessThan(tr);
    expect(tr).toBeLessThan(cs);
    expect(cs).toBeLessThan(nx);
  });

  it("excludes pricing", () => {
    expect(HOME_SECTION_ORDER).not.toContain("pricing");
  });
});
