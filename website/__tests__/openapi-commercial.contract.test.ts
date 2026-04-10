import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("openapi-commercial-v1 (public copy)", () => {
  it("lists reserve and plans paths matching implemented routes", () => {
    const p = path.join(__dirname, "..", "public", "openapi-commercial-v1.yaml");
    const t = readFileSync(p, "utf8");
    expect(t).toContain("/api/v1/usage/reserve");
    expect(t).toContain("/api/v1/commercial/plans");
    expect(t).toContain("reserveUsage");
    expect(t).toContain("getCommercialPlans");
    expect(t).toContain("VERIFICATION_REQUIRES_SUBSCRIPTION");
    expect(t).toMatch(/enum:\s*\[starter,\s*individual,\s*team,\s*business,\s*enterprise\]/);
  });
});
