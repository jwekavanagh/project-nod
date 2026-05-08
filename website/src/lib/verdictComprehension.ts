import {
  SHARED_REPORT_NEXT_FALLBACK_NON_TRUSTED,
  SHARED_REPORT_NEXT_TRUSTED,
  SHARED_REPORT_REASON_FALLBACK,
} from "./shareReportFallbacks";

export type VerdictComprehensionInput = {
  stateRelation: "matches_expectations" | "does_not_match" | "not_established";
  intentSummary: string;
  explanation: { details: { code: string; message: string }[] };
  failureSpine: {
    summary: string;
    rerunGuidance: string;
    primaryCodes?: string[];
  };
  evidenceCompleteness: {
    blockerCategory?: string;
    nextActions: { text?: string }[];
    remediationItems?: { actionText: string }[];
    verifiedClaims?: string[];
    unverifiedClaims?: string[];
    missingInputs?: { code: string; hint: string }[];
  };
};

export type VerdictCoverageSection = {
  checkedItems: string[];
  notCheckedItems: string[];
  missingInputItems: string[];
  counts: { checked: number; notChecked: number; missingInputs: number };
};

export type VerdictComprehensionModel = {
  primaryReason: string;
  nextAction: string;
  determinacyLine: string;
  coverage: VerdictCoverageSection;
};

const MAX_COVERAGE_ITEMS = 3;

function normalize(s: string | undefined): string {
  return (s ?? "").trim();
}

function firstMatchingDetailByCode(input: VerdictComprehensionInput, code: string): string | null {
  for (const row of input.explanation.details) {
    if (normalize(row.code) !== code) continue;
    const message = normalize(row.message);
    if (message.length > 0) return `${code}: ${message}`;
    return code;
  }
  return null;
}

function firstNonEmptyDetail(input: VerdictComprehensionInput): string | null {
  for (const row of input.explanation.details) {
    const code = normalize(row.code);
    const message = normalize(row.message);
    if (code.length === 0 && message.length === 0) continue;
    if (code.length > 0 && message.length > 0) return `${code}: ${message}`;
    return code.length > 0 ? code : message;
  }
  return null;
}

function pickPrimaryReason(input: VerdictComprehensionInput): string {
  if (input.stateRelation === "matches_expectations") {
    const detail = firstNonEmptyDetail(input);
    if (detail !== null) return detail;
    const trustedSummary = normalize(input.failureSpine.summary);
    if (trustedSummary.length > 0) return trustedSummary;
    const intent = normalize(input.intentSummary);
    if (intent.length > 0) return intent;
    return SHARED_REPORT_REASON_FALLBACK;
  }
  const primaryCode = normalize(input.failureSpine.primaryCodes?.[0]);
  if (primaryCode.length > 0) {
    const detail = firstMatchingDetailByCode(input, primaryCode);
    if (detail !== null) return detail;
    return primaryCode;
  }
  const detail = firstNonEmptyDetail(input);
  if (detail !== null) return detail;
  const spineSummary = normalize(input.failureSpine.summary);
  if (spineSummary.length > 0) return spineSummary;
  const intent = normalize(input.intentSummary);
  if (intent.length > 0) return intent;
  return SHARED_REPORT_REASON_FALLBACK;
}

function pickNextAction(input: VerdictComprehensionInput): string {
  if (input.stateRelation === "matches_expectations") return SHARED_REPORT_NEXT_TRUSTED;
  const next = normalize(input.evidenceCompleteness.nextActions?.[0]?.text);
  if (next.length > 0) return next;
  const remediation = normalize(input.evidenceCompleteness.remediationItems?.[0]?.actionText);
  if (remediation.length > 0) return remediation;
  const rerun = normalize(input.failureSpine.rerunGuidance);
  if (rerun.length > 0) return rerun;
  return SHARED_REPORT_NEXT_FALLBACK_NON_TRUSTED;
}

function pickDeterminacyLine(input: VerdictComprehensionInput): string {
  if (input.stateRelation === "does_not_match") {
    return "Determinate mismatch: observed state did not match expected state.";
  }
  if (input.stateRelation === "not_established") {
    const blocker = normalize(input.evidenceCompleteness.blockerCategory) || "unclassified";
    return `Unknown due to evidence blocker: ${blocker}.`;
  }
  return "Determinate match: expected state was verified.";
}

function pickCoverage(input: VerdictComprehensionInput): VerdictCoverageSection {
  const checked = input.evidenceCompleteness.verifiedClaims ?? [];
  const notChecked = input.evidenceCompleteness.unverifiedClaims ?? [];
  const missingInputs = (input.evidenceCompleteness.missingInputs ?? []).map((row) => `${row.code}: ${row.hint}`);
  return {
    checkedItems: checked.slice(0, MAX_COVERAGE_ITEMS),
    notCheckedItems: notChecked.slice(0, MAX_COVERAGE_ITEMS),
    missingInputItems: missingInputs.slice(0, MAX_COVERAGE_ITEMS),
    counts: { checked: checked.length, notChecked: notChecked.length, missingInputs: missingInputs.length },
  };
}

export function deriveVerdictComprehension(input: VerdictComprehensionInput): VerdictComprehensionModel {
  return {
    primaryReason: pickPrimaryReason(input),
    nextAction: pickNextAction(input),
    determinacyLine: pickDeterminacyLine(input),
    coverage: pickCoverage(input),
  };
}

