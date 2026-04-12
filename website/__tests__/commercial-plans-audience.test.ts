import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("config/commercial-plans.json", () => {
  const raw = JSON.parse(
    readFileSync(path.join(__dirname, "..", "..", "config", "commercial-plans.json"), "utf8"),
  ) as {
    recommendedPlanId: string;
    plans: Record<string, { audience?: string; valueUnlock?: string }>;
  };

  it("includes audience and valueUnlock for every plan", () => {
    for (const id of ["starter", "individual", "team", "business", "enterprise"]) {
      expect(raw.plans[id]?.audience, id).toBeTruthy();
      expect(raw.plans[id]?.valueUnlock, id).toBeTruthy();
    }
  });

  it("marks team as the recommended pricing tier", () => {
    expect(raw.recommendedPlanId).toBe("team");
    expect(raw.plans.team).toBeTruthy();
  });
});
