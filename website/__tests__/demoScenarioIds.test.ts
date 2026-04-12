import { describe, expect, it } from "vitest";
import {
  DEMO_SCENARIO_IDS,
  DEMO_SCENARIO_PRESENTATION,
  type DemoScenarioId,
} from "@/lib/demoScenarioIds";

describe("DEMO_SCENARIO_PRESENTATION", () => {
  it("has exactly one entry per scenario id with non-empty label and oneLiner", () => {
    const keys = Object.keys(DEMO_SCENARIO_PRESENTATION).sort() as string[];
    expect(keys).toEqual([...DEMO_SCENARIO_IDS].map(String).sort());
    for (const id of DEMO_SCENARIO_IDS) {
      const row = DEMO_SCENARIO_PRESENTATION[id];
      expect(row.label.length).toBeGreaterThan(3);
      expect(row.oneLiner.length).toBeGreaterThan(10);
    }
  });
});
