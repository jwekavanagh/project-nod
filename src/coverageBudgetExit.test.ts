import { describe, expect, it } from "vitest";
import { baseExitFromStateRelation, resolveFinalExitCode } from "./coverageBudgetExit.js";

describe("coverageBudgetExit", () => {
  it("baseExitFromStateRelation", () => {
    expect(baseExitFromStateRelation("matches_expectations")).toBe(0);
    expect(baseExitFromStateRelation("does_not_match")).toBe(1);
    expect(baseExitFromStateRelation("not_established")).toBe(2);
  });

  it("resolveFinalExitCode enforces budget fail only when active and flag", () => {
    expect(
      resolveFinalExitCode({
        baseExit: 0,
        budgetActive: true,
        budgetVerdict: "fail",
        enforceCoverageBudget: true,
      }),
    ).toBe(1);
    expect(
      resolveFinalExitCode({
        baseExit: 0,
        budgetActive: true,
        budgetVerdict: "fail",
        enforceCoverageBudget: false,
      }),
    ).toBe(0);
    expect(
      resolveFinalExitCode({
        baseExit: 1,
        budgetActive: true,
        budgetVerdict: "fail",
        enforceCoverageBudget: true,
      }),
    ).toBe(1);
  });
});
