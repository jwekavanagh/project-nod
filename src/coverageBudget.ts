import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import type { WitnessCoverageRollupJson } from "./witnessCoverageRollup.js";
import type { CoverageBudgetPolicyV1 } from "./coverageBudgetPolicy.js";

export type CoverageBudgetMachineCode = "PASS" | "FAIL_UNDERFULL" | "SKIP_NO_ENTRY" | "UNEVAL_NO_WITNESS";

export type CoverageBudgetVerdict = "pass" | "fail" | "skipped" | "unevaluable";

export type CoverageBudgetEvaluation = {
  verdict: CoverageBudgetVerdict;
  code: CoverageBudgetMachineCode;
  /** Single machine line after `coverage_budget_verdict:` */
  detailLine: string;
  /** Inserted before humanReport in stderr (includes trailing newline before human). */
  humanBlock: string;
};

const COVERAGE_BUDGET_BEGIN = "=== coverage_budget ===";
const COVERAGE_BUDGET_END = "=== end coverage_budget ===";

function sortedCsv(kinds: string[]): string {
  if (kinds.length === 0) return "-";
  return [...kinds].sort((a, b) => a.localeCompare(b)).join(",");
}

function buildDetailLine(args: {
  workflowId: string;
  verdict: CoverageBudgetVerdict;
  required: string[];
  satisfied: string[];
  missing: string[];
  code: CoverageBudgetMachineCode;
}): string {
  const wf = encodeURIComponent(args.workflowId);
  return [
    `workflow=${wf}`,
    `verdict=${args.verdict}`,
    `required=${sortedCsv(args.required)}`,
    `satisfied=${sortedCsv(args.satisfied)}`,
    `missing=${sortedCsv(args.missing)}`,
    `code=${args.code}`,
  ].join(" ");
}

function buildHumanBlock(args: {
  policyPath: string;
  requiredKinds: string;
  observed: string;
  resultLine: string;
}): string {
  return (
    `${COVERAGE_BUDGET_BEGIN}\n` +
    `policy_path: ${args.policyPath}\n` +
    `required_kinds: ${args.requiredKinds}\n` +
    `observed_fully_satisfied: ${args.observed}\n` +
    `result: ${args.resultLine}\n` +
    `${COVERAGE_BUDGET_END}\n`
  );
}

function witnessRollup(
  certificate: OutcomeCertificateV1,
): WitnessCoverageRollupJson | null {
  const w = certificate.evidenceCompleteness?.witnessCoverage;
  if (!w || w.schemaVersion !== 1 || !Array.isArray(w.fullySatisfiedKinds)) return null;
  return w as WitnessCoverageRollupJson;
}

/**
 * Phase B: evaluate policy row against certificate witness rollup (after certificate exists).
 */
export function evaluateCoverageBudgetPhaseB(options: {
  certificate: OutcomeCertificateV1;
  policy: CoverageBudgetPolicyV1;
  policyPath: string;
}): CoverageBudgetEvaluation {
  const { certificate, policy, policyPath } = options;
  const row = policy.workflows.find((r) => r.workflowId === certificate.workflowId);
  if (row === undefined) {
    const detailLine = buildDetailLine({
      workflowId: certificate.workflowId,
      verdict: "skipped",
      required: [],
      satisfied: [],
      missing: [],
      code: "SKIP_NO_ENTRY",
    });
    const human = buildHumanBlock({
      policyPath,
      requiredKinds: "-",
      observed: "-",
      resultLine: `skipped_no_entry (no policy row for workflow "${certificate.workflowId}")`,
    });
    return {
      verdict: "skipped",
      code: "SKIP_NO_ENTRY",
      detailLine,
      humanBlock: human,
    };
  }

  const required = [...row.minimumFullySatisfiedKinds].sort((a, b) => a.localeCompare(b));
  const W = witnessRollup(certificate);
  if (W === null) {
    const detailLine = buildDetailLine({
      workflowId: certificate.workflowId,
      verdict: "unevaluable",
      required,
      satisfied: [],
      missing: [],
      code: "UNEVAL_NO_WITNESS",
    });
    const human = buildHumanBlock({
      policyPath,
      requiredKinds: sortedCsv(required),
      observed: "-",
      resultLine: "unevaluable_no_witness_rollup (certificate lacks witnessCoverage.fullySatisfiedKinds)",
    });
    return {
      verdict: "unevaluable",
      code: "UNEVAL_NO_WITNESS",
      detailLine,
      humanBlock: human,
    };
  }

  const satisfiedSet = new Set<string>(W.fullySatisfiedKinds);
  const satisfied = [...W.fullySatisfiedKinds].sort((a, b) => a.localeCompare(b));
  const missing = required.filter((k) => !satisfiedSet.has(k));

  if (missing.length === 0) {
    const detailLine = buildDetailLine({
      workflowId: certificate.workflowId,
      verdict: "pass",
      required,
      satisfied,
      missing: [],
      code: "PASS",
    });
    const human = buildHumanBlock({
      policyPath,
      requiredKinds: sortedCsv(required),
      observed: sortedCsv(satisfied),
      resultLine: "pass",
    });
    return { verdict: "pass", code: "PASS", detailLine, humanBlock: human };
  }

  const detailLine = buildDetailLine({
    workflowId: certificate.workflowId,
    verdict: "fail",
    required,
    satisfied,
    missing,
    code: "FAIL_UNDERFULL",
  });
  const human = buildHumanBlock({
    policyPath,
    requiredKinds: sortedCsv(required),
    observed: sortedCsv(satisfied),
    resultLine:
      "fail — state_relation may still be matches_expectations; coverage budget not satisfied.",
  });
  return { verdict: "fail", code: "FAIL_UNDERFULL", detailLine, humanBlock: human };
}

export function writeCoverageBudgetMachineLinesToStderr(evaluation: CoverageBudgetEvaluation): void {
  process.stderr.write(`coverage_budget_verdict: ${evaluation.verdict}\n`);
  process.stderr.write(`coverage_budget_detail: ${evaluation.detailLine}\n`);
}
