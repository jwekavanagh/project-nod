/**
 * Collect and classify workflow reason codes for remediation / evidence gap (no evidenceCompleteness import).
 */

import type { WorkflowResult } from "./types.js";
import type { EvidenceGapPrimary } from "./types.js";
import { RESOLVE_FAILURE_CODES } from "./resolveFailureCodes.js";
import { REGISTRY_RESOLVER_CODE, SQL_VERIFICATION_OUTCOME_CODE as SQL } from "./wireReasonCodes.js";

const REGISTRY_CODES = new Set<string>(Object.values(REGISTRY_RESOLVER_CODE));

export function collectWorkflowCodes(result: WorkflowResult): Set<string> {
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

export function classifyWorkflowBlocker(result: WorkflowResult): EvidenceGapPrimary {
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
