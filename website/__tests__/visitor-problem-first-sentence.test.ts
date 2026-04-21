import { describe, expect, it } from "vitest";
import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { visitorProblemFirstSentence } from "@/lib/visitorProblemFirstSentence";

describe("visitorProblemFirstSentence", () => {
  it("returns the first sentence of discovery visitorProblemAnswer", () => {
    const full = discoveryAcquisition.visitorProblemAnswer;
    const first = visitorProblemFirstSentence();
    expect(full.startsWith(first)).toBe(true);
    expect(first).toMatch(/[.!?]$/);
    expect(first.length).toBeLessThan(full.length);
  });
});
