import { describe, expect, it } from "vitest";
import {
  assertBodySizeWithinLimit,
  parseAndValidateEnvelope,
} from "@/lib/publicVerificationReportService";

describe("publicVerificationReportService", () => {
  it("assertBodySizeWithinLimit throws with status 413 beyond cap", () => {
    const s = "a".repeat(393217);
    expect(() => assertBodySizeWithinLimit(s)).toThrow();
    try {
      assertBodySizeWithinLimit(s);
    } catch (e) {
      expect((e as Error & { status?: number }).status).toBe(413);
    }
  });

  it("parseAndValidateEnvelope rejects invalid envelope", () => {
    expect(() => parseAndValidateEnvelope({ foo: 1 })).toThrow();
    try {
      parseAndValidateEnvelope({ foo: 1 });
    } catch (e) {
      expect((e as Error & { status?: number }).status).toBe(400);
    }
  });
});
