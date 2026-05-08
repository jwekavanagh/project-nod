import { DatabaseSync } from "node:sqlite";
import { aggregateWorkflow } from "./aggregate.js";
import { loadEventsForWorkflow } from "./loadEvents.js";
import { enrichNoStepsRunLevelReasons } from "./noStepsMessage.js";
import { prepareWorkflowEvents } from "./prepareWorkflowEvents.js";
import { canonicalJsonForParams } from "./canonicalParams.js";
import { planLogicalSteps, type LogicalStepPlan } from "./planLogicalSteps.js";
import { reconcileSqlRowAsync } from "./reconciler.js";
import {
  buildRegistryMap,
  renderIntendedEffect,
  resolveVerificationRequest,
} from "./resolveExpectation.js";
import { loadRegistryEntriesAfterSchema } from "./toolsRegistryLoad.js";
import { reconcileStateWitness } from "./stateWitness.js";
import { openVerificationSqlTarget } from "./verificationConnections.js";
import type {
  EventFileAggregateCounts,
  EventSequenceIntegrity,
  IntendedEffect,
  ObservedExecution,
  Reason,
  StepOutcome,
  RunEvent,
  ToolObservedEvent,
  ToolRegistryEntry,
  VerificationDatabase,
  VerificationPolicy,
  WorkflowEngineResult,
  WorkflowResult,
} from "./types.js";
import {
  CLI_OPERATIONAL_CODES,
  RETRY_OBSERVATIONS_DIVERGE_MESSAGE,
  runLevelIssue,
} from "./failureCatalog.js";
import { TruthLayerError } from "./truthLayerError.js";
import {
  finalizeEmittedWorkflowResult,
  formatWorkflowTruthReport,
} from "./workflowTruthReport.js";
import {
  createSqlitePolicyContext,
  executeVerificationWithPolicyAsync,
  executeVerificationWithPolicySync,
  resolveVerificationPolicyInput,
  type PolicyReconcileContext,
} from "./verificationPolicy.js";
import { withFailureDiagnostic } from "./verificationDiagnostics.js";
import { buildVerificationRunContext } from "./verificationRunContext.js";
import { SQL_VERIFICATION_OUTCOME_CODE } from "./wireReasonCodes.js";

function defaultTruthReportToStderr(report: string): void {
  process.stderr.write(`${report}\n`);
}
export function loadToolsRegistry(registryPath: string): Map<string, ToolRegistryEntry> {
  return buildRegistryMap(loadRegistryEntriesAfterSchema(registryPath));
}

/** Registry `releaseCritical` (default false when omitted or unknown tool). */
export function registryReleaseCritical(entry: ToolRegistryEntry | undefined): boolean {
  return entry?.releaseCritical === true;
}

function observedExecutionFromParams(params: Record<string, unknown>): ObservedExecution {
  return { paramsCanonical: canonicalJsonForParams(params) };
}

/** Stable rollup key for LangGraph checkpoint trust (v3 `tool_observed` only). */
export function langgraphCheckpointKeyFromToolObserved(ev: ToolObservedEvent): string | undefined {
  if (ev.schemaVersion !== 3) return undefined;
  const c = ev.langgraphCheckpoint;
  return `${c.threadId}\u001f${c.checkpointNs}\u001f${c.checkpointId}`;
}

function withOptionalLanggraphCheckpointKey<T extends StepOutcome>(outcome: T, ev: ToolObservedEvent): T {
  const key = langgraphCheckpointKeyFromToolObserved(ev);
  if (key === undefined) return outcome;
  return { ...outcome, langgraphCheckpointKey: key };
}

function intendedEffectNarrative(
  entry: ToolRegistryEntry | undefined,
  toolId: string,
  params: Record<string, unknown>,
): IntendedEffect {
  const narrative = entry
    ? renderIntendedEffect(entry.effectDescriptionTemplate, params)
    : `Unknown tool: ${toolId}`;
  return { narrative };
}

function buildDivergentStepOutcome(
  plan: LogicalStepPlan,
  registry: Map<string, ToolRegistryEntry>,
): StepOutcome {
  const last = plan.last;
  const n = plan.repeatObservationCount;
  const entry = registry.get(last.toolId);
  return withOptionalLanggraphCheckpointKey(
    {
      seq: plan.seq,
      toolId: last.toolId,
      releaseCritical: registryReleaseCritical(entry),
      intendedEffect: intendedEffectNarrative(entry, last.toolId, last.params),
      observedExecution: observedExecutionFromParams(last.params),
      verificationRequest: null,
      status: "incomplete_verification",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.RETRY_OBSERVATIONS_DIVERGE,
          message: RETRY_OBSERVATIONS_DIVERGE_MESSAGE,
        },
      ],
      evidenceSummary: {},
      repeatObservationCount: n,
      evaluatedObservationOrdinal: n,
    },
    last,
  );
}

function logStepOutcome(
  logStep: (line: object) => void,
  workflowId: string,
  outcome: StepOutcome,
): void {
  logStep({
    workflowId,
    seq: outcome.seq,
    toolId: outcome.toolId,
    intendedEffect: outcome.intendedEffect,
    observedExecution: outcome.observedExecution,
    verificationRequest: outcome.verificationRequest,
    status: outcome.status,
    reasons: outcome.reasons,
    evidenceSummary: outcome.evidenceSummary,
    repeatObservationCount: outcome.repeatObservationCount,
    evaluatedObservationOrdinal: outcome.evaluatedObservationOrdinal,
    ...(outcome.failureDiagnostic !== undefined ? { failureDiagnostic: outcome.failureDiagnostic } : {}),
  });
}

export function verifyToolObservedStep(options: {
  workflowId: string;
  ev: ToolObservedEvent;
  registry: Map<string, ToolRegistryEntry>;
  db: DatabaseSync;
  logStep: (line: object) => void;
  verificationPolicy: VerificationPolicy;
  repeatObservationCount?: number;
  verificationDatabase?: VerificationDatabase;
}): StepOutcome {
  const { workflowId, ev, registry, db, logStep, verificationPolicy, verificationDatabase } = options;
  const repeatObservationCount = options.repeatObservationCount ?? 1;
  const evaluatedObservationOrdinal = repeatObservationCount;
  const entry = registry.get(ev.toolId);
  if (!entry) {
    const outcome: StepOutcome = {
      seq: ev.seq,
      toolId: ev.toolId,
      releaseCritical: false,
      intendedEffect: intendedEffectNarrative(undefined, ev.toolId, ev.params),
      observedExecution: observedExecutionFromParams(ev.params),
      verificationRequest: null,
      status: "incomplete_verification",
      reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.UNKNOWN_TOOL, message: `Unknown toolId: ${ev.toolId}` }],
      evidenceSummary: {},
      repeatObservationCount,
      evaluatedObservationOrdinal,
    };
    const finalized = withOptionalLanggraphCheckpointKey(withFailureDiagnostic(outcome), ev);
    logStepOutcome(logStep, workflowId, finalized);
    return finalized;
  }

  const intendedEffect = intendedEffectNarrative(entry, ev.toolId, ev.params);
  const observedExecution = observedExecutionFromParams(ev.params);
  const resolved = resolveVerificationRequest(entry, ev.params, verificationDatabase);
  if (!resolved.ok) {
    const outcome: StepOutcome = {
      seq: ev.seq,
      toolId: ev.toolId,
      releaseCritical: registryReleaseCritical(entry),
      intendedEffect,
      observedExecution,
      verificationRequest: null,
      status: "incomplete_verification",
      reasons: [{ code: resolved.code, message: resolved.message }],
      evidenceSummary: {},
      repeatObservationCount,
      evaluatedObservationOrdinal,
    };
    const finalized = withOptionalLanggraphCheckpointKey(withFailureDiagnostic(outcome), ev);
    logStepOutcome(logStep, workflowId, finalized);
    return finalized;
  }

  const exec = executeVerificationWithPolicySync(db, resolved, verificationPolicy);
  const outcome: StepOutcome = {
    seq: ev.seq,
    toolId: ev.toolId,
    releaseCritical: registryReleaseCritical(entry),
    intendedEffect,
    observedExecution,
    verificationRequest: exec.verificationRequest,
    status: exec.status,
    reasons: exec.reasons,
    evidenceSummary: exec.evidenceSummary,
    repeatObservationCount,
    evaluatedObservationOrdinal,
  };
  const finalized = withOptionalLanggraphCheckpointKey(withFailureDiagnostic(outcome), ev);
  logStepOutcome(logStep, workflowId, finalized);
  return finalized;
}

async function verifyToolObservedStepAsync(options: {
  workflowId: string;
  ev: ToolObservedEvent;
  registry: Map<string, ToolRegistryEntry>;
  ctx: PolicyReconcileContext;
  logStep: (line: object) => void;
  verificationPolicy: VerificationPolicy;
  repeatObservationCount?: number;
  verificationDatabase?: VerificationDatabase;
}): Promise<StepOutcome> {
  const { workflowId, ev, registry, ctx, logStep, verificationPolicy, verificationDatabase } = options;
  const repeatObservationCount = options.repeatObservationCount ?? 1;
  const evaluatedObservationOrdinal = repeatObservationCount;
  const entry = registry.get(ev.toolId);
  if (!entry) {
    const outcome: StepOutcome = {
      seq: ev.seq,
      toolId: ev.toolId,
      releaseCritical: false,
      intendedEffect: intendedEffectNarrative(undefined, ev.toolId, ev.params),
      observedExecution: observedExecutionFromParams(ev.params),
      verificationRequest: null,
      status: "incomplete_verification",
      reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.UNKNOWN_TOOL, message: `Unknown toolId: ${ev.toolId}` }],
      evidenceSummary: {},
      repeatObservationCount,
      evaluatedObservationOrdinal,
    };
    const finalized = withOptionalLanggraphCheckpointKey(withFailureDiagnostic(outcome), ev);
    logStepOutcome(logStep, workflowId, finalized);
    return finalized;
  }

  const intendedEffect = intendedEffectNarrative(entry, ev.toolId, ev.params);
  const observedExecution = observedExecutionFromParams(ev.params);
  const resolved = resolveVerificationRequest(entry, ev.params, verificationDatabase);
  if (!resolved.ok) {
    const outcome: StepOutcome = {
      seq: ev.seq,
      toolId: ev.toolId,
      releaseCritical: registryReleaseCritical(entry),
      intendedEffect,
      observedExecution,
      verificationRequest: null,
      status: "incomplete_verification",
      reasons: [{ code: resolved.code, message: resolved.message }],
      evidenceSummary: {},
      repeatObservationCount,
      evaluatedObservationOrdinal,
    };
    const finalized = withOptionalLanggraphCheckpointKey(withFailureDiagnostic(outcome), ev);
    logStepOutcome(logStep, workflowId, finalized);
    return finalized;
  }

  const exec = await executeVerificationWithPolicyAsync(resolved, verificationPolicy, ctx);
  const outcome: StepOutcome = {
    seq: ev.seq,
    toolId: ev.toolId,
    releaseCritical: registryReleaseCritical(entry),
    intendedEffect,
    observedExecution,
    verificationRequest: exec.verificationRequest,
    status: exec.status,
    reasons: exec.reasons,
    evidenceSummary: exec.evidenceSummary,
    repeatObservationCount,
    evaluatedObservationOrdinal,
  };
  const finalized = withOptionalLanggraphCheckpointKey(withFailureDiagnostic(outcome), ev);
  logStepOutcome(logStep, workflowId, finalized);
  return finalized;
}

function runLogicalStepsVerificationSync(options: {
  workflowId: string;
  events: ToolObservedEvent[];
  registry: Map<string, ToolRegistryEntry>;
  db: DatabaseSync;
  logStep: (line: object) => void;
  verificationPolicy: VerificationPolicy;
  verificationDatabase: VerificationDatabase;
}): StepOutcome[] {
  const plans = planLogicalSteps(options.events);
  const out: StepOutcome[] = [];
  for (const plan of plans) {
    const n = plan.repeatObservationCount;
    if (plan.divergent) {
      const outcome = buildDivergentStepOutcome(plan, options.registry);
      const finalized = withFailureDiagnostic(outcome);
      logStepOutcome(options.logStep, options.workflowId, finalized);
      out.push(finalized);
      continue;
    }
    out.push(
        verifyToolObservedStep({
          workflowId: options.workflowId,
          ev: plan.last,
          registry: options.registry,
          db: options.db,
          logStep: options.logStep,
          verificationPolicy: options.verificationPolicy,
          repeatObservationCount: n,
          verificationDatabase: options.verificationDatabase,
        }),
    );
  }
  return out;
}

async function runLogicalStepsVerificationAsync(options: {
  workflowId: string;
  events: ToolObservedEvent[];
  registry: Map<string, ToolRegistryEntry>;
  ctx: PolicyReconcileContext;
  logStep: (line: object) => void;
  verificationPolicy: VerificationPolicy;
  verificationDatabase: VerificationDatabase;
}): Promise<StepOutcome[]> {
  const plans = planLogicalSteps(options.events);
  const out: StepOutcome[] = [];
  for (const plan of plans) {
    const n = plan.repeatObservationCount;
    if (plan.divergent) {
      const outcome = buildDivergentStepOutcome(plan, options.registry);
      const finalized = withFailureDiagnostic(outcome);
      logStepOutcome(options.logStep, options.workflowId, finalized);
      out.push(finalized);
      continue;
    }
    out.push(
      await verifyToolObservedStepAsync({
        workflowId: options.workflowId,
        ev: plan.last,
        registry: options.registry,
        ctx: options.ctx,
        logStep: options.logStep,
        verificationPolicy: options.verificationPolicy,
        repeatObservationCount: n,
        verificationDatabase: options.verificationDatabase,
      }),
    );
  }
  return out;
}

/** Single kernel: reconciles prepared tool events + run metadata against a registry-backed DB. */
export type VerifyRunStateFromEventsInput = {
  workflowId: string;
  events: ToolObservedEvent[];
  runEvents: RunEvent[];
  runLevelReasons: Reason[];
  eventSequenceIntegrity: EventSequenceIntegrity;
  eventFileAggregateCounts: EventFileAggregateCounts;
  registry: Map<string, ToolRegistryEntry>;
  database: VerificationDatabase;
  verificationPolicy: VerificationPolicy;
  logStep: (line: object) => void;
  truthReport: (report: string) => void;
};

export async function verifyRunStateFromEvents(input: VerifyRunStateFromEventsInput): Promise<WorkflowResult> {
  const {
    workflowId,
    events,
    runEvents,
    runLevelReasons,
    eventSequenceIntegrity,
    eventFileAggregateCounts,
    registry,
    database,
    verificationPolicy,
    logStep: log,
    truthReport,
  } = input;

  let steps: StepOutcome[];

  if (database.kind === "sqlite") {
    let db: DatabaseSync;
    try {
      db = new DatabaseSync(database.path, { readOnly: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new TruthLayerError(CLI_OPERATIONAL_CODES.SQLITE_DATABASE_OPEN_FAILED, msg, { cause: e });
    }
    try {
      if (verificationPolicy.consistencyMode === "strong") {
        steps = runLogicalStepsVerificationSync({
          workflowId,
          events,
          registry,
          db,
          logStep: log,
          verificationPolicy,
          verificationDatabase: database,
        });
      } else {
        const ctx = createSqlitePolicyContext(db);
        steps = await runLogicalStepsVerificationAsync({
          workflowId,
          events,
          registry,
          ctx,
          logStep: log,
          verificationPolicy,
          verificationDatabase: database,
        });
      }
    } finally {
      db.close();
    }
  } else {
    let target: Awaited<ReturnType<typeof openVerificationSqlTarget>>;
    try {
      target = await openVerificationSqlTarget(database);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new TruthLayerError(CLI_OPERATIONAL_CODES.POSTGRES_CLIENT_SETUP_FAILED, msg, { cause: e });
    }
    const ctx: PolicyReconcileContext = {
      reconcileRow: (req) => reconcileSqlRowAsync(target.sqlRead, req),
      reconcileRowAbsent: (req) => target.sqlRead.reconcileRowAbsent(req),
      reconcileRelationalCheck: (check) => target.reconcileRelationalCheck(check),
      reconcileStateWitness: reconcileStateWitness,
    };
    try {
      steps = await runLogicalStepsVerificationAsync({
        workflowId,
        events,
        registry,
        ctx,
        logStep: log,
        verificationPolicy,
        verificationDatabase: database,
      });
    } finally {
      await target.close();
    }
  }

  const engineBase = aggregateWorkflow(
    workflowId,
    steps,
    runLevelReasons,
    verificationPolicy,
    eventSequenceIntegrity,
  );
  enrichNoStepsRunLevelReasons(workflowId, engineBase.runLevelReasons, eventFileAggregateCounts);
  const engine = { ...engineBase, verificationRunContext: buildVerificationRunContext(runEvents) };
  truthReport(formatWorkflowTruthReport(engine));
  return finalizeEmittedWorkflowResult(engine);
}

export async function verifyWorkflow(options: {
  workflowId: string;
  eventsPath: string;
  registryPath: string;
  database: VerificationDatabase;
  verificationPolicy?: VerificationPolicy;
  logStep?: (line: object) => void;
  truthReport?: (report: string) => void;
}): Promise<WorkflowResult> {
  const { eventsPath, registryPath, workflowId, database } = options;
  const log = options.logStep ?? (() => {});
  const truthReport = options.truthReport ?? defaultTruthReportToStderr;
  const verificationPolicy = resolveVerificationPolicyInput(options.verificationPolicy);

  const load = loadEventsForWorkflow(eventsPath, workflowId);
  const registry = loadToolsRegistry(registryPath);

  return verifyRunStateFromEvents({
    workflowId,
    events: load.events,
    runEvents: load.runEvents,
    runLevelReasons: load.runLevelReasons,
    eventSequenceIntegrity: load.eventSequenceIntegrity,
    eventFileAggregateCounts: load.eventFileAggregateCounts,
    registry,
    database,
    verificationPolicy,
    logStep: log,
    truthReport,
  });
}
