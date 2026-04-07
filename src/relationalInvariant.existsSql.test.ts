import { describe, expect, it } from "vitest";
import { buildRelatedExistsSql } from "./relationalInvariant.js";

describe("buildRelatedExistsSql", () => {
  it("emits EXISTS for both dialects and never COUNT(*)", () => {
    for (const dialect of ["sqlite", "postgres"] as const) {
      const { text } = buildRelatedExistsSql(dialect, "child", "fk");
      expect(text).toContain("EXISTS (");
      expect(text).not.toMatch(/COUNT\s*\(\s*\*\s*\)/i);
    }
  });
});
