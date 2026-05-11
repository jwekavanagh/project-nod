import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { TruthLayerError } from "./truthLayerError.js";
import { loadSchemaValidator } from "./schemaLoad.js";

export type CoverageBudgetPolicyV1 = {
  schemaVersion: 1;
  workflows: Array<{ workflowId: string; minimumFullySatisfiedKinds: string[] }>;
};

export type CoverageBudgetPhaseAResult =
  | { active: false }
  | { active: true; policyPath: string; policy: CoverageBudgetPolicyV1 };

function assertUniqueWorkflowIds(policy: CoverageBudgetPolicyV1): void {
  const seen = new Set<string>();
  for (const row of policy.workflows) {
    if (seen.has(row.workflowId)) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.CLI_USAGE,
        `coverage-budget: duplicate workflowId "${row.workflowId}" in policy file.`,
      );
    }
    seen.add(row.workflowId);
  }
}

/**
 * Phase A: resolve optional policy path, read + validate before verify I/O.
 * @param explicitCoverageBudgetPath --coverage-budget value when set (may be relative)
 * @param projectPathResolved absolute --project root when present
 */
export function loadCoverageBudgetPolicyPhaseA(options: {
  explicitCoverageBudgetPath: string | undefined;
  projectPathResolved: string | undefined;
}): CoverageBudgetPhaseAResult {
  const cwd = process.cwd();
  let filePath: string | null = null;

  if (options.explicitCoverageBudgetPath !== undefined && options.explicitCoverageBudgetPath.length > 0) {
    filePath = path.resolve(cwd, options.explicitCoverageBudgetPath);
    if (!existsSync(filePath)) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.CLI_USAGE,
        `coverage-budget: file not found at ${filePath}`,
      );
    }
  } else if (options.projectPathResolved !== undefined) {
    const candidate = path.join(options.projectPathResolved, "agentskeptic", "coverage-budget.json");
    if (!existsSync(candidate)) {
      return { active: false };
    }
    filePath = candidate;
  } else {
    return { active: false };
  }

  const raw = readFileSync(filePath!, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      `coverage-budget: invalid JSON at ${filePath}`,
    );
  }

  const validate = loadSchemaValidator("coverage-budget-v1");
  if (!validate(parsed)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      `coverage-budget: schema validation failed at ${filePath}: ${JSON.stringify(validate.errors ?? [])}`,
    );
  }

  const policy = parsed as CoverageBudgetPolicyV1;
  assertUniqueWorkflowIds(policy);
  return { active: true, policyPath: filePath!, policy };
}
