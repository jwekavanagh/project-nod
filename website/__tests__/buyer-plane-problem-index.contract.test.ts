import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import discoveryAcquisition from "@/lib/discoveryAcquisition";

const primaryRe = /^\/(guides|examples|compare)\/[a-z0-9-]+$/;
const relatedRe =
  /^\/(guides|examples|compare)\/[a-z0-9-]+$|^\/(integrate|pricing|database-truth-vs-traces)$/;

describe("buyer plane problemIndex contract", () => {
  it("matches config/discovery-acquisition.json publication order", () => {
    const raw = readFileSync(join(process.cwd(), "..", "config", "discovery-acquisition.json"), "utf8");
    const parsed = JSON.parse(raw) as { problemIndex: typeof discoveryAcquisition.problemIndex };
    expect(parsed.problemIndex).toEqual(discoveryAcquisition.problemIndex);
  });

  it("every row satisfies routed path patterns", () => {
    for (const row of discoveryAcquisition.problemIndex) {
      expect(row.moment.length).toBeGreaterThanOrEqual(12);
      expect(row.primaryRoute).toMatch(primaryRe);
      for (const r of row.relatedRoutes ?? []) {
        expect(r).toMatch(relatedRe);
      }
    }
  });
});
