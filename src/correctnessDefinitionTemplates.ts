/**
 * Forward-looking correctness templates. Normative semantics: docs/correctness-definition-normative.md.
 * CD_DOC_ANCHORS must appear in that file (doc parity test).
 */

export const CD_DOC_ANCHORS = [
  "CD_TPL_RUN_INGEST",
  "CD_TPL_EVENT_CAPTURE",
  "CD_TPL_RUN_CONTEXT",
  "CD_TPL_STEP_SQL",
  "CD_TPL_PLAN_TRANSITION",
  "CD_TPL_QUICK_ROW",
  "CD_TPL_QUICK_REL",
  "CD_TPL_QUICK_GAP",
] as const;

export const CORRECTNESS_ENFORCEMENT_KINDS = [
  "run_ingest_integrity",
  "event_capture_integrity",
  "run_context_fairness",
  "step_sql_expectation",
  "plan_transition_expectation",
  "quick_inferred_sql_row",
  "quick_inferred_relational",
  "quick_mapping_gap",
] as const;

export type CorrectnessEnforcementKind = (typeof CORRECTNESS_ENFORCEMENT_KINDS)[number];

function fill(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`<${k}>`).join(v);
  }
  return out;
}

/** CD_TPL_RUN_INGEST */
export function templateRunIngestMustHold(vars: {
  workflowId: string;
  P: string;
  codes: string;
  nonEmptySteps: boolean;
}): string {
  const tail = vars.nonEmptySteps
    ? " The stream SHALL yield at least one tool_observed step for verification."
    : "";
  return fill(
    "Must: ingest for workflowId=<workflowId> SHALL deliver a valid captured run under policy [<P>] with no blocking run-level failures (codes: <codes>)." + tail,
    { workflowId: vars.workflowId, P: vars.P, codes: vars.codes },
  );
}

export function templateRunIngestEnforceAs(codes: string): [string, string] {
  return [
    "Ingest pipelines SHALL validate each event line against the wire event contract before verification.",
    fill("CI or preflight SHALL reject captures that surface primary failure codes <codes> for this workflow under the same policy.", {
      codes,
    }),
  ];
}

/** CD_TPL_EVENT_CAPTURE */
export function templateEventCaptureMustHold(vars: { workflowId: string; P: string; codes: string }): string {
  return fill(
    "Must: event capture for workflowId=<workflowId> SHALL preserve monotonic, well-formed ordering under policy [<P>] and SHALL NOT emit event-sequence fault codes <codes>.",
    vars,
  );
}

export function templateEventCaptureEnforceAs(codes: string): [string, string] {
  return [
    "Capture agents SHALL preserve capture-order and timestamp monotonicity rules required for seq-sorted verification.",
    fill("Automated checks SHALL fail runs that include codes <codes> in the event_sequence integrity set.", { codes }),
  ];
}

/** CD_TPL_RUN_CONTEXT */
export function templateRunContextMustHold(vars: {
  workflowId: string;
  P: string;
  I: string;
  C: string;
  codes: string;
}): string {
  return fill(
    "Must: before evaluating the failing tool observation at ingest_index=<I>, upstream run context SHALL satisfy contract <C> under policy [<P>] for workflowId=<workflowId> (primary codes: <codes>).",
    vars,
  );
}

export function templateRunContextEnforceAs(C: string): [string, string] {
  return [
    "Orchestration SHALL record retrieval, model turns, controls, and tool_skipped events so fairness can be checked at the failing ingest index.",
    fill("Replays SHALL not evaluate downstream tool_observed steps when <C> is violated for that index.", { C }),
  ];
}

/** CD_TPL_STEP_SQL */
export function templateStepSqlMustHold(vars: { W: string; S: string; T: string; P: string }): string {
  return fill(
    "Must: after tool_observed seq=<S> toolId=<T>, database state SHALL satisfy the verification contract in verificationRequest under policy [<P>] for workflowId=<W>.",
    { W: vars.W, S: vars.S, T: vars.T, P: vars.P },
  );
}

export function templateStepSqlEnforceAs(S: string): [string, string] {
  return [
    fill("Registry (or synthetic events plus registry) SHALL keep verificationRequest aligned with declared tool parameters for seq=<S>.", {
      S,
    }),
    "Authoritative SQL state SHALL match identity, required fields, and relational checks encoded in verificationRequest.",
  ];
}

/** CD_TPL_PLAN_TRANSITION */
export function templatePlanTransitionMustHold(vars: { W: string; S: string; T: string; P: string; codes: string }): string {
  return fill(
    "Must: plan-validation step seq=<S> toolId=<T> SHALL satisfy declared plan rules under policy [<P>] for workflowId=<W> (primary codes: <codes>).",
    vars,
  );
}

export function templatePlanTransitionEnforceAs(): [string, string] {
  return [
    "Plan.md rules and git transition inputs SHALL remain aligned with the verification target for this step.",
    "CI SHALL re-run plan-transition verification after changing patterns or git refs implicated by this failure.",
  ];
}

/** CD_TPL_QUICK_ROW */
export function templateQuickRowMustHold(vars: { toolName: string; A: string; table: string }): string {
  return fill(
    "Must: when tool <toolName> actionIndex=<A> is treated as successful for quick verification, table <table> SHALL satisfy the inferred sql_row contract (provisional, not a signed export) under read-only SQL checks.",
    vars,
  );
}

export function templateQuickRowEnforceAs(table: string): [string, string] {
  return [
    fill("Structured tool activity SHALL continue to expose parameters needed to infer identity and required fields for table <table>.", {
      table,
    }),
    "For production enforcement, promote this check to contract verification via exported registry and synthetic events when eligible.",
  ];
}

/** CD_TPL_QUICK_REL */
export function templateQuickRelMustHold(vars: { toolName: string; A: string; T: string }): string {
  return fill(
    "Must: when tool <toolName> actionIndex=<A> is treated as successful, related row existence for childTable=<T> SHALL hold as checked by the inferred related_exists contract (provisional).",
    vars,
  );
}

export function templateQuickRelEnforceAs(T: string): [string, string] {
  return [
    fill("Foreign-key or pointer fields in structured activity SHALL remain sufficient to infer match columns for <T>.", { T }),
    "For full contract coverage, add explicit sql_relational tooling in the registry; quick inference does not export all relational rules.",
  ];
}

/** CD_TPL_QUICK_GAP */
export function templateQuickGapMustHold(vars: { toolName: string; A: string; codes: string }): string {
  return fill(
    "Must: either structured tool activity for tool <toolName> actionIndex=<A> SHALL map to an inferrable sql_row check, or you SHALL add an explicit registry-backed expectation—provisional quick verification cannot enforce this action until one path exists (reason codes: <codes>).",
    vars,
  );
}

export function templateQuickGapEnforceAs(): [string, string] {
  return [
    "Extend ingest fields or tool naming so row identity and required columns can be inferred, or author a registry tool for this action.",
    "Re-run quick verify; then use contract replay for exported row tools to lock the expectation in batch mode.",
  ];
}
