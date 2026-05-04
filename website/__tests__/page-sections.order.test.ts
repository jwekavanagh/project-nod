import { HOME_SECTION_ORDER } from "@/app/page.sections";
import { describe, expect, it } from "vitest";

describe("HOME_SECTION_ORDER", () => {
  it("matches shortened homepage (hero → closing)", () => {
    expect([...HOME_SECTION_ORDER]).toEqual(["hero", "tryIt", "howItWorks", "homeClosing"]);
    expect(HOME_SECTION_ORDER.length).toBe(4);
  });

  it("orders sections monotonically", () => {
    const he = HOME_SECTION_ORDER.indexOf("hero");
    const tr = HOME_SECTION_ORDER.indexOf("tryIt");
    const hw = HOME_SECTION_ORDER.indexOf("howItWorks");
    const cl = HOME_SECTION_ORDER.indexOf("homeClosing");
    expect(he).toBeLessThan(tr);
    expect(tr).toBeLessThan(hw);
    expect(hw).toBeLessThan(cl);
  });

  it("excludes pricing", () => {
    expect(HOME_SECTION_ORDER).not.toContain("pricing");
  });
});
