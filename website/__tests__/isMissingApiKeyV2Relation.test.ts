import { describe, expect, it } from "vitest";
import { isMissingApiKeyV2Relation } from "@/lib/isMissingApiKeyV2Relation";

describe("isMissingApiKeyV2Relation", () => {
  it("matches Drizzle-wrapped PostgresError with cause 42P01 (production log shape)", () => {
    const inner = Object.assign(new Error('relation "api_key_v2" does not exist'), {
      code: "42P01",
    });
    const outer = Object.assign(
      new Error('Failed query: select ... from "api_key_v2" where ...'),
      { cause: inner },
    );
    expect(isMissingApiKeyV2Relation(outer)).toBe(true);
  });

  it("matches top-level relation message", () => {
    expect(
      isMissingApiKeyV2Relation(new Error('relation "api_key_v2" does not exist')),
    ).toBe(true);
  });

  it("returns false for other undefined_table errors", () => {
    const err = Object.assign(new Error('relation "other_table" does not exist'), {
      code: "42P01",
    });
    expect(isMissingApiKeyV2Relation(err)).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    expect(isMissingApiKeyV2Relation(new Error("connection refused"))).toBe(false);
  });
});
