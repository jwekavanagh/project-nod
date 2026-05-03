/**
 * Canonical evidence completeness object (schemas/evidence-completeness-v1.schema.json).
 */

import type { RecommendedActionCode, WorkflowEngineResult, WorkflowResult } from "./types.js";
import { deriveActionableFailureWorkflow } from "./actionableFailure.js";
import { remediationMessageForRecommendedAction } from "./remediationMessage.js";
import { RESOLVE_FAILURE_CODES } from "./verificationDiagnostics.js";
import { REGISTRY_RESOLVER_CODE, SQL_VERIFICATION_OUTCOME_CODE as SQL } from "./wireReasonCodes.js";
import { userPhraseForReasonCode } from "./verificationUserPhrases.js";
import { redactEvidenceString } from "./redactEvidenceString.js";

export type EvidenceGapPrimary =
  | "none"
  | "preview_lane"
  | "ingest_empty"
  | "ingest_unstructured"
  | "registry_unknown_tool"
  | "registry_resolution"
  | "database_access"
  | "timing_or_window"
  | "witness_unavailable"
  | "state_mismatch"
  | "verification_incomplete"
  | "event_sequence"
  | "control_flow_context"
  | "unclassified";

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
};

const REGISTRY_CODES = new Set<string>(Object.values(REGISTRY_RESOLVER_CODE));

function capList(lines: string[], max: number, eachMax: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length && out.length < max; i++) {
    out.push(redactEvidenceString(lines[i]!, eachMax));
  }
  return out;
}

function collectWorkflowCodes(result: WorkflowResult): Set<string> {
  const s = new Set<string>();
  for (const r of result.runLevelReasons) s.add(r.code);
  if (result.eventSequenceIntegrity.kind === "irregular") {
    for (const r of result.eventSequenceIntegrity.reasons) s.add(r.code);
  }
  for (const step of result.steps) {
    for (const r of step.reasons) s.add(r.code);
  }
  return s;
}

function classifyWorkflowBlocker(result: WorkflowResult): EvidenceGapPrimary {
  const C = collectWorkflowCodes(result);
  if (C.has("NO_STEPS_FOR_WORKFLOW")) return "ingest_empty";
  if (C.has("MALFORMED_EVENT_LINE")) return "ingest_unstructured";
  if (result.eventSequenceIntegrity.kind === "irregular") return "event_sequence";

  const ctx = result.verificationRunContext;
  if (ctx.toolSkippedEvents.length > 0) return "control_flow_context";
  if (ctx.controlEvents.some((e) => e.decision === "skipped")) return "control_flow_context";
  if (ctx.modelTurnEvents.some((e) => e.status !== "completed")) return "control_flow_context";

  if (C.has(SQL.UNKNOWN_TOOL)) return "registry_unknown_tool";
  for (const c of C) {
    if (REGISTRY_CODES.has(c) || RESOLVE_FAILURE_CODES.has(c)) return "registry_resolution";
  }
  if (
    C.has(SQL.STATE_WITNESS_UNAVAILABLE_IN_SQLITE_FILE_MODE) ||
    C.has(SQL.STATE_WITNESS_SETUP_ERROR)
  ) {
    return "witness_unavailable";
  }

  if (
    C.has(SQL.CONNECTOR_ERROR) ||
    C.has(SQL.ROW_SHAPE_MISMATCH) ||
    C.has(SQL.UNREADABLE_VALUE) ||
    C.has(SQL.VECTOR_PROVIDER_ERROR) ||
    C.has(SQL.HTTP_WITNESS_NETWORK_ERROR)
  ) {
    return "database_access";
  }

  if (
    C.has(SQL.ROW_NOT_OBSERVED_WITHIN_WINDOW) ||
    C.has(SQL.MULTI_EFFECT_UNCERTAIN_WITHIN_WINDOW) ||
    C.has(SQL.FORBIDDEN_ROWS_STILL_PRESENT_WITHIN_WINDOW) ||
    C.has(SQL.BOUNDED_WINDOW_EXPIRED_WITHOUT_OBSERVATION)
  ) {
    return "timing_or_window";
  }

  if (result.status === "inconsistent") return "state_mismatch";
  if (result.status === "incomplete") return "verification_incomplete";
  return "none";
}

function nextActionsFromRemediation(code: RecommendedActionCode): Array<{ id: string; text: string }> {
  const text = redactEvidenceString(remediationMessageForRecommendedAction(code), 500);
  return [{ id: code, text }];
}

function syntheticFailureBase(result: WorkflowResult) {
  const codes = [...collectWorkflowCodes(result)].sort((a, b) => a.localeCompare(b)).slice(0, 12);
  return {
    summary: "Synthetic failure analysis for evidence completeness fallback.",
    primaryOrigin: "workflow_flow" as const,
    confidence: "medium" as const,
    unknownReasonCodes: [] as string[],
    evidence:
      codes.length > 0
        ? [{ scope: "run_level" as const, codes }]
        : [{ scope: "step" as const, codes: ["UNCLASSIFIED_GAP"], seq: 0, toolId: "" }],
    alternativeHypotheses: undefined as undefined,
  };
}

export function workflowResultToEngineSlice(result: WorkflowResult): WorkflowEngineResult {
  const { workflowTruthReport: _omit, schemaVersion: _sv, ...rest } = result;
  return { ...rest, schemaVersion: 8 };
}

export function buildEvidenceCompletenessFromWorkflowResult(result: WorkflowResult): EvidenceCompletenessJson {
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
  const fa = truth.failureAnalysis;
  let recommended: RecommendedActionCode = "manual_review";

  const engineSlice = workflowResultToEngineSlice(result);
  if (fa === null && result.status === "complete") {
    recommended = "none";
  } else {
    const base = fa ?? syntheticFailureBase(result);
    recommended = deriveActionableFailureWorkflow(engineSlice, base).recommendedAction;
  }

  const primaryCodes = [...collectWorkflowCodes(result)].sort((a, b) => a.localeCompare(b)).slice(0, 8);
  const missingInputs = primaryCodes.map((code) => {
    const phrase = userPhraseForReasonCode(code);
    return {
      code: redactEvidenceString(code, 72),
      hint: phrase ? redactEvidenceString(phrase, 400) : redactEvidenceString(code, 400),
    };
  });

  const nextActions =
    result.status === "complete" && fa === null ? nextActionsFromRemediation("none") : nextActionsFromRemediation(recommended);

  return {
    schemaVersion: 1,
    blockerCategory,
    quickSignal: "na",
    verifiedClaims: capList(verified, 24, 160),
    unverifiedClaims: capList(unverified, 24, 160),
    missingInputs,
    nextActions,
  };
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

export function buildEvidenceCompletenessFromQuickReport(input: QuickReportEvidenceInput): EvidenceCompletenessJson {
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

  const nextActions: Array<{ id: string; text: string }> = [];
  nextActions.push({
    id: "rerun_quick_or_promote_contract",
    text: redactEvidenceString(
      "For decision-grade reliance, export registry and events then run agentskeptic check (contract mode).",
      500,
    ),
  });
  if (quickSignal !== "sql_ran_passed") {
    nextActions.push({
      id: "fix_ingest_or_mapping",
      text: redactEvidenceString("Fix ingest shape or mapping failures shown in units, then rerun quick verify.", 500),
    });
  }

  return {
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
}

/** LangGraph checkpoint trust ineligible: no runnable verification trace. */
export function buildEvidenceCompletenessForIneligibleLangGraph(params: {
  headline: string;
  details: Array<{ code: string; message: string }>;
}): EvidenceCompletenessJson {
  const { headline, details } = params;
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
        text: redactEvidenceString(
          "Repair NDJSON capture so checkpoint trust receives schema-valid schemaVersion 3 tool_observed lines for this workflow, then rerun verify.",
          500,
        ),
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
