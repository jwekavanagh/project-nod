import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_CSS_SNIPPET } from "@/a11y/cssMotionContract";

function normalizeLf(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

describe("reduced-motion CSS contract", () => {
  it("globals.css contains the canonical prefers-reduced-motion block", () => {
    const css = readFileSync(path.join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    expect(normalizeLf(css)).toContain(normalizeLf(REDUCED_MOTION_CSS_SNIPPET));
  });
});
