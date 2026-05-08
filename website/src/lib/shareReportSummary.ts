import {
  SHARED_REPORT_HEADLINE_FALLBACK,
  SHARED_REPORT_VERDICT_NOT_TRUSTED,
  SHARED_REPORT_VERDICT_TRUSTED,
  SHARED_REPORT_VERDICT_UNKNOWN,
} from "./shareReportFallbacks";
import { deriveVerdictComprehension, type VerdictComprehensionInput } from "./verdictComprehension";

/** Mirrors `truthCheckVerdictFromCertificate` in core (`src/outcomeCertificate.ts`) — duplicated here so the website bundle does not import the `agentskeptic` barrel (pulls Node-only deps under Vitest). */
export type TruthCheckVerdictLabel = "trusted" | "not_trusted" | "unknown";

function truthCheckVerdictFromStructured(cert: {
  stateRelation: string;
  highStakesReliance: string;
}): TruthCheckVerdictLabel {
  if (cert.stateRelation === "matches_expectations" && cert.highStakesReliance === "permitted") {
    return "trusted";
  }
  if (cert.stateRelation === "does_not_match") {
    return "not_trusted";
  }
  return "unknown";
}

/** Minimal certificate surface for summary derivation (structured fields only). */
export type CertificateForExecutiveSummary = {
  stateRelation: "matches_expectations" | "does_not_match" | "not_established";
  highStakesReliance: "permitted" | "prohibited";
  intentSummary: string;
  explanation: { headline: string; details: { code: string; message: string }[] };
  failureSpine: {
    summary: string;
    rerunGuidance: string;
    primaryCodes?: string[];
  };
  evidenceCompleteness: {
    blockerCategory?: string;
    verifiedClaims?: string[];
    unverifiedClaims?: string[];
    missingInputs?: { code: string; hint: string }[];
    nextActions: { text?: string }[];
    remediationItems?: { actionText: string }[];
  };
};

export type SharedReportExecutiveModel = {
  verdictLabel: string;
  headline: string;
  reason: string;
  nextAction: string;
  determinacyLine: string;
  checkedItems: string[];
  notCheckedItems: string[];
  missingInputItems: string[];
};

function pickHeadline(cert: CertificateForExecutiveSummary): string {
  const h = cert.explanation.headline.trim();
  if (h.length > 0) return h;
  return SHARED_REPORT_HEADLINE_FALLBACK;
}

function verdictLabelFor(v: TruthCheckVerdictLabel): string {
  if (v === "trusted") return SHARED_REPORT_VERDICT_TRUSTED;
  if (v === "not_trusted") return SHARED_REPORT_VERDICT_NOT_TRUSTED;
  return SHARED_REPORT_VERDICT_UNKNOWN;
}

/** Pure selectors over structured Outcome Certificate fields (no stderr / audit prose parsing). */
export function executiveSummaryFromCertificate(cert: CertificateForExecutiveSummary): SharedReportExecutiveModel {
  const verdict = truthCheckVerdictFromStructured(cert);
  const comprehension = deriveVerdictComprehension(cert as VerdictComprehensionInput);
  return {
    verdictLabel: verdictLabelFor(verdict),
    headline: pickHeadline(cert),
    reason: comprehension.primaryReason,
    nextAction: comprehension.nextAction,
    determinacyLine: comprehension.determinacyLine,
    checkedItems: comprehension.coverage.checkedItems,
    notCheckedItems: comprehension.coverage.notCheckedItems,
    missingInputItems: comprehension.coverage.missingInputItems,
  };
}

export function isOutcomeCertificateV3Payload(value: unknown): value is CertificateForExecutiveSummary {
  if (value === null || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    o.schemaVersion === 3 &&
    typeof o.workflowId === "string" &&
    o.workflowId.length > 0 &&
    typeof o.stateRelation === "string" &&
    typeof o.highStakesReliance === "string" &&
    o.explanation !== null &&
    typeof o.explanation === "object" &&
    o.failureSpine !== null &&
    typeof o.failureSpine === "object" &&
    o.evidenceCompleteness !== null &&
    typeof o.evidenceCompleteness === "object"
  );
}
