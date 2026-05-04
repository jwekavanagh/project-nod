import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import marketing from "@/lib/marketing";

const primaryRe = /^\/(guides|examples|compare)\/[a-z0-9-]+$/;
const relatedRe =
  /^\/(guides|examples|compare)\/[a-z0-9-]+$|^\/(integrate|pricing|database-truth-vs-traces)$/;

describe("buyer plane problemIndex contract", () => {
  it("matches config/marketing.json publication order", () => {
    const raw = readFileSync(join(process.cwd(), "..", "config", "marketing.json"), "utf8");
    const parsed = JSON.parse(raw) as { problemIndex: typeof marketing.problemIndex };
    expect(parsed.problemIndex).toEqual(marketing.problemIndex);
  });

  it("every row satisfies routed path patterns", () => {
    for (const row of marketing.problemIndex) {
      expect(row.moment.length).toBeGreaterThanOrEqual(8);
      expect(row.primaryRoute).toMatch(primaryRe);
      const related = "relatedRoutes" in row && Array.isArray(row.relatedRoutes) ? row.relatedRoutes : [];
      for (const r of related) {
        expect(r).toMatch(relatedRe);
      }
    }
  });
});
