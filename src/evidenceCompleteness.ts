/**
 * Canonical evidence completeness object (schemas/evidence-completeness-v1.schema.json).
 */

import type { EvidenceGapPrimary, RemediationDecision, RemediationItem, RerunPath, RerunReadiness, WorkflowResult } from "./types.js";
import { userPhraseForReasonCode } from "./verificationUserPhrases.js";
import { redactEvidenceString } from "./redactEvidenceString.js";
import { classifyWorkflowBlocker, collectWorkflowCodes } from "./workflowFailureSignals.js";
import { buildWitnessCoverageFromSteps } from "./witnessCoverageRollup.js";
import type { WitnessCoverageRollupJson } from "./witnessCoverageRollup.js";

export type { EvidenceGapPrimary } from "./types.js";

export type QuickSignalEvidence =
  | "na"
  | "no_actions"
  | "no_structured_activity"
  | "no_sql_candidates"
  | "sql_ran_uncertain"
  | "sql_ran_failed"
  | "sql_ran_passed";

/** Wire + runtime shape (certificate / quick stdout). */
export type EvidenceCompletenessJson = {
  schemaVersion: 1;
  blockerCategory: EvidenceGapPrimary;
  quickSignal: QuickSignalEvidence;
  verifiedClaims: string[];
  unverifiedClaims: string[];
  missingInputs: Array<{ code: string; hint: string }>;
  nextActions: Array<{ id: string; text: string }>;
  rerunReadiness?: RerunReadiness;
  rerunPath?: RerunPath;
  remediationItems?: RemediationItem[];
  /** Contract / LangGraph certificate producers emit rollup; optional for legacy or quick previews. */
  witnessCoverage?: WitnessCoverageRollupJson;
};

function capList(lines: string[], max: number, eachMax: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length && out.length < max; i++) {
    out.push(redactEvidenceString(lines[i]!, eachMax));
  }
  return out;
}

export { classifyWorkflowBlocker } from "./workflowFailureSignals.js";

export { workflowResultToEngineSlice } from "./workflowResultSlice.js";

export function buildEvidenceCompletenessFromWorkflowResult(
  result: WorkflowResult,
  decision: RemediationDecision,
): EvidenceCompletenessJson {
  const truth = result.workflowTruthReport;
  const verified: string[] = [];
  const unverified: string[] = [];

  for (const st of truth.steps) {
    const label = `${st.toolId}:seq=${st.seq}`;
    if (st.outcomeLabel === "VERIFIED") {
      verified.push(redactEvidenceString(`${label}: verified`, 160));
    } else {
      const msg = st.reasons[0]?.message ?? st.outcomeLabel;
      unverified.push(redactEvidenceString(`${label}: ${msg}`, 160));
    }
  }

  const blockerCategory = classifyWorkflowBlocker(result);

  const primaryCodes = [...collectWorkflowCodes(result)].sort((a, b) => a.localeCompare(b)).slice(0, 8);
  const missingInputs = primaryCodes.map((code) => {
    const phrase = userPhraseForReasonCode(code);
    return {
      code: redactEvidenceString(code, 72),
      hint: phrase ? redactEvidenceString(phrase, 400) : redactEvidenceString(code, 400),
    };
  });

  const nextActions = decision.orderedNextActions.map((a) => ({
    id: a.id,
    text: a.text,
  }));

  const out: EvidenceCompletenessJson = {
    schemaVersion: 1,
    blockerCategory,
    quickSignal: "na",
    verifiedClaims: capList(verified, 24, 160),
    unverifiedClaims: capList(unverified, 24, 160),
    missingInputs,
    nextActions,
    witnessCoverage: buildWitnessCoverageFromSteps(result.steps),
  };
  if (!(result.status === "complete" && truth.failureAnalysis === null)) {
    out.rerunReadiness = decision.rerunReadiness;
    out.rerunPath = decision.rerunPath;
    out.remediationItems = decision.remediationItems;
  }
  return out;
}

export type QuickReportEvidenceInput = {
  verdict: "pass" | "fail" | "uncertain";
  ingest: { reasonCodes: string[] };
  units: Array<{
    unitId: string;
    verdict: "verified" | "fail" | "uncertain";
    reasonCodes: string[];
    sourceAction: { toolName: string };
    reconciliation: { verification_verdict: string };
    verification: Record<string, unknown>;
  }>;
};

function classifyQuickBlocker(signal: QuickSignalEvidence, verdict: string): EvidenceGapPrimary {
  if (signal === "no_actions") return "ingest_empty";
  if (signal === "no_structured_activity") return "ingest_unstructured";
  if (signal === "no_sql_candidates") return "registry_resolution";
  if (signal === "sql_ran_failed") return "state_mismatch";
  if (verdict === "uncertain") return "verification_incomplete";
  return "preview_lane";
}

export function buildEvidenceCompletenessFromQuickReport(
  input: QuickReportEvidenceInput,
  decision: RemediationDecision,
): EvidenceCompletenessJson {
  const { ingest, units, verdict } = input;

  let quickSignal: QuickSignalEvidence = "sql_ran_uncertain";
  if (ingest.reasonCodes.includes("INGEST_NO_ACTIONS")) {
    quickSignal = "no_actions";
  } else if (ingest.reasonCodes.includes("INGEST_NO_STRUCTURED_TOOL_ACTIVITY")) {
    quickSignal = "no_structured_activity";
  } else if (units.length === 0) {
    quickSignal = "no_sql_candidates";
  } else {
    const mappedOk = units.filter((u) => !u.reasonCodes.includes("MAPPING_FAILED")).length > 0;
    if (!mappedOk) {
      quickSignal = "no_sql_candidates";
    } else if (verdict === "pass") quickSignal = "sql_ran_passed";
    else if (verdict === "fail") quickSignal = "sql_ran_failed";
    else quickSignal = "sql_ran_uncertain";
  }

  const verified: string[] = [];
  const unverified: string[] = [];
  for (const u of units) {
    if (u.verdict === "verified") {
      verified.push(redactEvidenceString(`unit=${u.unitId} tool=${u.sourceAction.toolName}`, 160));
    } else {
      unverified.push(
        redactEvidenceString(`unit=${u.unitId} tool=${u.sourceAction.toolName}: ${u.reconciliation.verification_verdict}`, 160),
      );
    }
  }

  let missingInputs: Array<{ code: string; hint: string }> = [];
  if (ingest.reasonCodes.length > 0) {
    missingInputs.push({
      code: redactEvidenceString("ingest", 72),
      hint: redactEvidenceString(ingest.reasonCodes.join(","), 400),
    });
  } else if (units.length > 0) {
    const firstFailed = units.find((u) => u.reasonCodes.length > 0);
    if (firstFailed) {
      missingInputs.push({
        code: redactEvidenceString(firstFailed.reasonCodes[0]!, 72),
        hint: redactEvidenceString(`${firstFailed.unitId}:${firstFailed.sourceAction.toolName}`, 400),
      });
    }
  }
  missingInputs = missingInputs.slice(0, 8);

  const blockerCategory = classifyQuickBlocker(quickSignal, verdict);

  const nextActions = decision.orderedNextActions.map((a) => ({
    id: a.id,
    text: a.text,
  }));

  const out: EvidenceCompletenessJson = {
    schemaVersion: 1,
    blockerCategory,
    quickSignal,
    verifiedClaims: capList(verified, 24, 160),
    unverifiedClaims: capList(unverified, 24, 160),
    missingInputs:
      missingInputs.length > 0
        ? missingInputs
        : [{ code: redactEvidenceString("none_reported", 72), hint: redactEvidenceString("No structured missing-field entries.", 400) }],
    nextActions,
  };
  if (verdict !== "pass") {
    out.rerunReadiness = decision.rerunReadiness;
    out.rerunPath = decision.rerunPath;
    out.remediationItems = decision.remediationItems;
  }
  return out;
}

/** LangGraph checkpoint trust ineligible: no runnable verification trace. */
export function buildEvidenceCompletenessForIneligibleLangGraph(params: {
  headline: string;
  details: Array<{ code: string; message: string }>;
}): EvidenceCompletenessJson {
  const { headline, details } = params;
  const actionText =
    "Repair NDJSON capture so checkpoint trust receives schema-valid schemaVersion 3 tool_observed lines for this workflow, then rerun verify.";
  return {
    schemaVersion: 1,
    blockerCategory: "verification_incomplete",
    quickSignal: "na",
    verifiedClaims: [],
    unverifiedClaims: [redactEvidenceString(headline, 200)],
    missingInputs: details.slice(0, 8).map((d) => ({
      code: redactEvidenceString(d.code, 72),
      hint: redactEvidenceString(d.message, 400),
    })),
    nextActions: [
      {
        id: "fix_langgraph_eligibility",
        text: redactEvidenceString(actionText, 500),
      },
    ],
    rerunReadiness: "fix_inputs_before_rerun",
    rerunPath: {
      type: "after_input_fix_verify",
      sameInputs: false,
      prerequisite: "Registry, events, tool parameters, or verification inputs are corrected.",
      meaningfulWhen: "The corrected inputs express the expected state the verifier should check.",
      readinessLabel: "Rerun verify after registry, events, tool parameters, or verification inputs are corrected.",
    },
    witnessCoverage: buildWitnessCoverageFromSteps([]),
    remediationItems: [
      {
        id: "quick_ingest",
        scope: "quick_ingest",
        primary: true,
        failedCheck: "LangGraph checkpoint trust eligibility",
        reasonCodes: details.slice(0, 8).map((d) => redactEvidenceString(d.code, 128)),
        reason: redactEvidenceString(headline, 1024),
        recommendedAction: "fix_event_ingest_and_steps",
        actionText: redactEvidenceString(actionText, 500),
        expectedState: {
          summary: "Expected schema-valid schemaVersion 3 tool_observed lines for this workflow.",
        },
        automation: {
          class: "input_regeneration_candidate",
          label:
            "Automation candidate: repair inputs outside the verifier; AgentSkeptic will not mutate external systems.",
          boundary:
            "AgentSkeptic is a read-only verifier. It does not mutate databases, rewrite inputs, or execute remediation.",
        },
        humanReview: { required: false },
        rerunPath: {
          type: "after_input_fix_verify",
          sameInputs: false,
          prerequisite: "Registry, events, tool parameters, or verification inputs are corrected.",
          meaningfulWhen: "The corrected inputs express the expected state the verifier should check.",
          readinessLabel: "Rerun verify after registry, events, tool parameters, or verification inputs are corrected.",
        },
      },
    ],
  };
}

/** Deterministic completeness object for minimal tests and fixtures (normative blocker `none`). */
export function minimalEvidenceCompletenessFixture(overrides?: Partial<EvidenceCompletenessJson>): EvidenceCompletenessJson {
  const base: EvidenceCompletenessJson = {
    schemaVersion: 1,
    blockerCategory: "none",
    quickSignal: "na",
    verifiedClaims: [],
    unverifiedClaims: [],
    missingInputs: [{ code: redactEvidenceString("fixture", 72), hint: redactEvidenceString("Test fixture completeness row.", 400) }],
    nextActions: [{ id: "none", text: redactEvidenceString("No further action required.", 500) }],
  };
  return { ...base, ...overrides };
}
