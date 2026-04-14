import { describe, expect, it } from "vitest";
import { normalizedSqlRowRequestFingerprint } from "./verificationRequestFingerprint.js";
import type { VerificationRequest } from "../types.js";

describe("normalizedSqlRowRequestFingerprint", () => {
  it("is stable for identityEq and requiredFields key order", () => {
    const a: VerificationRequest = {
      kind: "sql_row",
      table: "t",
      identityEq: [
        { column: "b", value: "2" },
        { column: "a", value: "1" },
      ],
      requiredFields: { z: 1, y: 0 },
    };
    const b: VerificationRequest = {
      kind: "sql_row",
      table: "t",
      identityEq: [
        { column: "a", value: "1" },
        { column: "b", value: "2" },
      ],
      requiredFields: { y: 0, z: 1 },
    };
    expect(normalizedSqlRowRequestFingerprint(a)).toBe(normalizedSqlRowRequestFingerprint(b));
  });
});
