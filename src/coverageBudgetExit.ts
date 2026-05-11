import type { CoverageBudgetVerdict } from "./coverageBudget.js";

export function baseExitFromStateRelation(stateRelation: string): 0 | 1 | 2 {
  if (stateRelation === "matches_expectations") return 0;
  if (stateRelation === "does_not_match") return 1;
  return 2;
}

export function resolveFinalExitCode(args: {
  baseExit: 0 | 1 | 2;
  budgetActive: boolean;
  budgetVerdict: CoverageBudgetVerdict | null;
  enforceCoverageBudget: boolean;
}): 0 | 1 | 2 {
  const { baseExit, budgetActive, budgetVerdict, enforceCoverageBudget } = args;
  if (baseExit !== 0) return baseExit;
  if (!budgetActive || budgetVerdict === null) return 0;
  if (enforceCoverageBudget && budgetVerdict === "fail") return 1;
  return 0;
}
