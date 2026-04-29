import { describe, expect, it, vi } from "vitest";
import bundled from "../../config/commercial-plans.json";

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    existsSync: () => true,
    readFileSync: () => {
      throw new Error("ENOENT simulated");
    },
  };
});

const { loadCommercialPlans } = await import("@/lib/plans");

describe("loadCommercialPlans", () => {
  it("returns bundled catalog when readFileSync fails (mirrors missing config on disk in serverless)", () => {
    const got = loadCommercialPlans();
    expect(got.schemaVersion).toBe(bundled.schemaVersion);
    expect(got.recommendedPlanId).toBe(bundled.recommendedPlanId);
    expect(got.plans.starter.displayPrice).toBe(bundled.plans.starter.displayPrice);
  });
});
