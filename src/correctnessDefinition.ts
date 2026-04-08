import { PLAN_TRANSITION_WORKFLOW_ID } from "./planTransitionConstants.js";
import { policyFragment } from "./failureExplanation.js";
import { formatOperationalMessage } from "./failureCatalog.js";
import type { VerificationRequest } from "./types.js";
import type { ResolvedRelationalCheck } from "./types.js";
import type {
  CorrectnessDefinitionV1,
  FailureAnalysis,
  FailureExplanationV1,
  RecommendedActionCode,
  StepVerificationRequest,
  WorkflowEngineResult,
  WorkflowTruthStep,
} from "./types.js";
import {
  templateEventCaptureEnforceAs,
  templateEventCaptureMustHold,
  templatePlanTransitionEnforceAs,
  templatePlanTransitionMustHold,
  templateQuickGapEnforceAs,
  templateQuickGapMustHold,
  templateQuickRelEnforceAs,
  templateQuickRelMustHold,
  templateQuickRowEnforceAs,
  templateQuickRowMustHold,
  templateRunContextEnforceAs,
  templateRunContextMustHold,
  templateRunIngestEnforceAs,
  templateRunIngestMustHold,
  templateStepSqlEnforceAs,
  templateStepSqlMustHold,
} from "./correctnessDefinitionTemplates.js";

export type CorrectnessDefinitionInvariantCode =
  | "CORRECTNESS_PRIMARY_SCOPE_MISSING"
  | "CORRECTNESS_RUN_CONTEXT_INDEX_MISSING"
  | "CORRECTNESS_UNKNOWN_RUN_CONTEXT_CODE";

export class CorrectnessDefinitionInvariantError extends Error {
  readonly code: CorrectnessDefinitionInvariantCode;
  constructor(code: CorrectnessDefinitionInvariantCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CorrectnessDefinitionInvariantError";
  }
}

type CorrectnessRemediationAlignment = { recommendedAction: RecommendedActionCode; automationSafe: boolean };

type RunIngestProjection = Extract<
  CorrectnessDefinitionV1["enforceableProjection"],
  { projectionKind: "run_ingest_integrity" }
>;
type EventCaptureProjection = Extract<
  CorrectnessDefinitionV1["enforceableProjection"],
  { projectionKind: "event_capture_integrity" }
>;
type RunContextProjection = Extract<
  CorrectnessDefinitionV1["enforceableProjection"],
  { projectionKind: "run_context_fairness" }
>;
type StepSqlProjection = Extract<
  CorrectnessDefinitionV1["enforceableProjection"],
  { projectionKind: "step_sql_expectation" }
>;
type PlanTransitionProjection = Extract<
  CorrectnessDefinitionV1["enforceableProjection"],
  { projectionKind: "plan_transition_expectation" }
>;

function factMap(fe: FailureExplanationV1): Map<string, string> {
  return new Map(fe.knownFacts.map((k) => [k.id, k.value] as const));
}

function sortUniqueCodes(codes: string[]): string[] {
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b));
}

function mapRunContextCodeToContract(code: string): RunContextProjection["requiredUpstreamContract"] {
  switch (code) {
    case "RETRIEVAL_ERROR":
      return "retrieval_ok_before_observation";
    case "MODEL_TURN_ERROR":
    case "MODEL_TURN_ABORTED":
    case "MODEL_TURN_INCOMPLETE":
      return "model_turn_completed_before_observation";
    case "CONTROL_INTERRUPT":
      return "no_interrupt_before_observation";
    case "CONTROL_BRANCH_SKIPPED":
      return "branch_not_skipped_before_observation";
    case "CONTROL_GATE_SKIPPED":
      return "gate_not_skipped_before_observation";
    case "TOOL_SKIPPED":
      return "tool_not_skipped_before_observation";
    default:
      throw new CorrectnessDefinitionInvariantError(
        "CORRECTNESS_UNKNOWN_RUN_CONTEXT_CODE",
        `Unknown run_context primary code for correctness contract: ${code}`,
      );
  }
}

function quickRemediationAlignment(sortedReasonCodes: string[]): CorrectnessRemediationAlignment {
  const c = sortedReasonCodes[0] ?? "";
  if (c === "CONNECTOR_ERROR") {
    return { recommendedAction: "improve_read_connectivity", automationSafe: false };
  }
  if (
    c === "MAPPING_FAILED" ||
    c.startsWith("RESOLVE_") ||
    c.includes("REGISTRY") ||
    c === "UNKNOWN_TOOL"
  ) {
    return { recommendedAction: "correct_verification_inputs", automationSafe: false };
  }
  if (
    c === "ROW_ABSENT" ||
    c === "VALUE_MISMATCH" ||
    c === "DUPLICATE_ROWS" ||
    c === "RELATIONAL_EXPECTATION_MISMATCH" ||
    c === "RELATIONAL_SCALAR_UNUSABLE" ||
    c === "ROW_PRESENT_WHEN_FORBIDDEN"
  ) {
    return { recommendedAction: "reconcile_downstream_state", automationSafe: false };
  }
  return { recommendedAction: "manual_review", automationSafe: false };
}

/** Batch / contract verification path: non-null iff `failureExplanation` is non-null. */
export function buildWorkflowCorrectnessDefinition(
  engine: WorkflowEngineResult,
  fe: FailureExplanationV1,
  fa: FailureAnalysis,
  truthSteps: WorkflowTruthStep[],
): CorrectnessDefinitionV1 {
  const m = factMap(fe);
  const scopeRaw = m.get("primary_scope");
  if (scopeRaw === undefined) {
    throw new CorrectnessDefinitionInvariantError(
      "CORRECTNESS_PRIMARY_SCOPE_MISSING",
      "failureExplanation.knownFacts missing primary_scope",
    );
  }

  const P = policyFragment(engine);
  const workflowId = engine.workflowId;
  const e0 = fa.evidence[0]!;
  const codesArr = sortUniqueCodes(e0.codes ?? []);
  const codesStr = codesArr.join(",");
  const remediationAlignment: CorrectnessRemediationAlignment = {
    recommendedAction: fa.actionableFailure.recommendedAction,
    automationSafe: fa.actionableFailure.automationSafe,
  };

  if (scopeRaw === "step" && codesArr.includes("NO_STEPS_FOR_WORKFLOW")) {
    const projection: RunIngestProjection = {
      projectionKind: "run_ingest_integrity",
      workflowId,
      verificationPolicyFragment: P,
      primaryFailureCodes: codesArr,
      ingestContractRequirement: "non_empty_tool_observed_steps",
    };
    const [a0, a1] = templateRunIngestEnforceAs(codesStr);
    return {
      schemaVersion: 1,
      enforcementKind: "run_ingest_integrity",
      mustAlwaysHold: formatOperationalMessage(
        templateRunIngestMustHold({ workflowId, P, codes: codesStr, nonEmptySteps: true }),
      ),
      enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
      enforceableProjection: projection,
      remediationAlignment,
    };
  }

  if (scopeRaw === "run_level") {
    const projection: RunIngestProjection = {
      projectionKind: "run_ingest_integrity",
      workflowId,
      verificationPolicyFragment: P,
      primaryFailureCodes: codesArr,
      ingestContractRequirement: "no_run_level_failures",
    };
    const [a0, a1] = templateRunIngestEnforceAs(codesStr);
    return {
      schemaVersion: 1,
      enforcementKind: "run_ingest_integrity",
      mustAlwaysHold: formatOperationalMessage(
        templateRunIngestMustHold({ workflowId, P, codes: codesStr, nonEmptySteps: false }),
      ),
      enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
      enforceableProjection: projection,
      remediationAlignment,
    };
  }

  if (scopeRaw === "event_sequence") {
    const projection: EventCaptureProjection = {
      projectionKind: "event_capture_integrity",
      workflowId,
      verificationPolicyFragment: P,
      forbiddenEventSequenceCodes: codesArr,
    };
    const [a0, a1] = templateEventCaptureEnforceAs(codesStr);
    return {
      schemaVersion: 1,
      enforcementKind: "event_capture_integrity",
      mustAlwaysHold: formatOperationalMessage(templateEventCaptureMustHold({ workflowId, P, codes: codesStr })),
      enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
      enforceableProjection: projection,
      remediationAlignment,
    };
  }

  if (scopeRaw === "run_context") {
    if (e0.ingestIndex === undefined) {
      throw new CorrectnessDefinitionInvariantError(
        "CORRECTNESS_RUN_CONTEXT_INDEX_MISSING",
        "run_context correctness requires ingestIndex on primary evidence",
      );
    }
    const primaryCode = codesArr[0] ?? "";
    const contract = mapRunContextCodeToContract(primaryCode);
    const projection: RunContextProjection = {
      projectionKind: "run_context_fairness",
      workflowId,
      verificationPolicyFragment: P,
      ingestIndex: e0.ingestIndex,
      requiredUpstreamContract: contract,
      primaryRunContextCodes: codesArr,
    };
    const I = String(e0.ingestIndex);
    const C = contract;
    const [a0, a1] = templateRunContextEnforceAs(C);
    return {
      schemaVersion: 1,
      enforcementKind: "run_context_fairness",
      mustAlwaysHold: formatOperationalMessage(
        templateRunContextMustHold({ workflowId, P, I, C, codes: codesStr }),
      ),
      enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
      enforceableProjection: projection,
      remediationAlignment,
    };
  }

  if (scopeRaw === "step") {
    if (e0.seq === undefined || e0.toolId === undefined) {
      throw new CorrectnessDefinitionInvariantError(
        "CORRECTNESS_PRIMARY_SCOPE_MISSING",
        "step correctness requires seq and toolId on primary evidence",
      );
    }
    const driver = engine.steps.find((s) => s.seq === e0.seq && s.toolId === e0.toolId);
    if (driver === undefined) {
      throw new CorrectnessDefinitionInvariantError(
        "CORRECTNESS_PRIMARY_SCOPE_MISSING",
        "step correctness driver not found in engine.steps",
      );
    }
    const ts = truthSteps.find((s) => s.seq === e0.seq && s.toolId === e0.toolId);
    if (ts === undefined) {
      throw new CorrectnessDefinitionInvariantError(
        "CORRECTNESS_PRIMARY_SCOPE_MISSING",
        "step correctness truth step not found",
      );
    }
    const S = String(e0.seq);
    const T = e0.toolId;
    const W = workflowId;

    if (workflowId === PLAN_TRANSITION_WORKFLOW_ID) {
      const projection: PlanTransitionProjection = {
        projectionKind: "plan_transition_expectation",
        workflowId: W,
        verificationPolicyFragment: P,
        seq: e0.seq,
        toolId: T,
        verifyTarget: ts.verifyTarget,
        primaryCodes: codesArr,
      };
      const [a0, a1] = templatePlanTransitionEnforceAs();
      return {
        schemaVersion: 1,
        enforcementKind: "plan_transition_expectation",
        mustAlwaysHold: formatOperationalMessage(
          templatePlanTransitionMustHold({ W, S, T, P, codes: codesStr }),
        ),
        enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
        enforceableProjection: projection,
        remediationAlignment,
      };
    }

    const projection: StepSqlProjection = {
      projectionKind: "step_sql_expectation",
      workflowId: W,
      verificationPolicyFragment: P,
      seq: e0.seq,
      toolId: T,
      verificationRequest: driver.verificationRequest,
    };
    const [a0, a1] = templateStepSqlEnforceAs(S);
    return {
      schemaVersion: 1,
      enforcementKind: "step_sql_expectation",
      mustAlwaysHold: formatOperationalMessage(templateStepSqlMustHold({ W, S, T, P })),
      enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
      enforceableProjection: projection,
      remediationAlignment,
    };
  }

  throw new CorrectnessDefinitionInvariantError(
    "CORRECTNESS_PRIMARY_SCOPE_MISSING",
    `Unsupported primary_scope for correctness: ${scopeRaw}`,
  );
}

export function buildQuickUnitCorrectnessDefinition(opts: {
  unitId: string;
  kind: "row" | "related_exists";
  toolName: string;
  actionIndex: number;
  table: string;
  reasonCodes: string[];
  sqlRowRequest?: VerificationRequest;
  relationalCheck?: ResolvedRelationalCheck & { checkKind: "related_exists" };
}): CorrectnessDefinitionV1 {
  const sortedRc = sortUniqueCodes(opts.reasonCodes);
  const rcStr = sortedRc.join(",");
  const ra = quickRemediationAlignment(sortedRc);

  if (opts.kind === "row") {
    if (opts.sqlRowRequest !== undefined) {
      const [a0, a1] = templateQuickRowEnforceAs(opts.table);
      return {
        schemaVersion: 1,
        enforcementKind: "quick_inferred_sql_row",
        mustAlwaysHold: formatOperationalMessage(
          templateQuickRowMustHold({
            toolName: opts.toolName,
            A: String(opts.actionIndex),
            table: opts.table,
          }),
        ),
        enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
        enforceableProjection: {
          projectionKind: "quick_inferred_sql_row",
          quickProvisional: true,
          unitId: opts.unitId,
          toolName: opts.toolName,
          actionIndex: opts.actionIndex,
          table: opts.table,
          sqlRowRequest: opts.sqlRowRequest,
        },
        remediationAlignment: ra,
      };
    }
    const [a0, a1] = templateQuickGapEnforceAs();
    return {
      schemaVersion: 1,
      enforcementKind: "quick_mapping_gap",
      mustAlwaysHold: formatOperationalMessage(
        templateQuickGapMustHold({
          toolName: opts.toolName,
          A: String(opts.actionIndex),
          codes: rcStr,
        }),
      ),
      enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
      enforceableProjection: {
        projectionKind: "quick_mapping_gap",
        quickProvisional: true,
        toolName: opts.toolName,
        actionIndex: opts.actionIndex,
        reasonCodes: sortedRc,
        table: opts.table === "" ? null : opts.table || null,
      },
      remediationAlignment: ra,
    };
  }

  const rel = opts.relationalCheck!;
  const [a0, a1] = templateQuickRelEnforceAs(rel.childTable);
  return {
    schemaVersion: 1,
    enforcementKind: "quick_inferred_relational",
    mustAlwaysHold: formatOperationalMessage(
      templateQuickRelMustHold({
        toolName: opts.toolName,
        A: String(opts.actionIndex),
        T: rel.childTable,
      }),
    ),
    enforceAs: [formatOperationalMessage(a0), formatOperationalMessage(a1)],
    enforceableProjection: {
      projectionKind: "quick_inferred_relational",
      quickProvisional: true,
      unitId: opts.unitId,
      toolName: opts.toolName,
      actionIndex: opts.actionIndex,
      childTable: rel.childTable,
      checkId: rel.id,
      matchEq: rel.matchEq.map((p) => ({ column: p.column, value: p.value })),
    },
    remediationAlignment: ra,
  };
}
