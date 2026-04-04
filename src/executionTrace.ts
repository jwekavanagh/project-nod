import { CLI_OPERATIONAL_CODES } from "./failureCatalog.js";
import { planLogicalSteps } from "./planLogicalSteps.js";
import { TruthLayerError } from "./truthLayerError.js";
import type {
  ControlRunEvent,
  ExecutionTraceBackwardPath,
  ExecutionTraceNode,
  ExecutionTraceView,
  ExecutionTraceVerificationLink,
  ModelTurnRunEvent,
  RetrievalRunEvent,
  RunEvent,
  ToolObservedEvent,
  ToolSkippedRunEvent,
  TraceStepKind,
  WorkflowResult,
} from "./types.js";

export function isToolObservedRunEvent(ev: RunEvent): ev is ToolObservedEvent {
  return ev.type === "tool_observed";
}

/** Validates v2 `runEventId` uniqueness and `parentRunEventId` referential + ordering rules. */
export function assertValidRunEventParentGraph(runEvents: RunEvent[]): void {
  const idToIndex = new Map<string, number>();
  for (let i = 0; i < runEvents.length; i++) {
    const ev = runEvents[i]!;
    if (ev.schemaVersion !== 2) continue;
    const id = ev.runEventId;
    if (idToIndex.has(id)) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.TRACE_DUPLICATE_RUN_EVENT_ID,
        `Duplicate runEventId: ${id}`,
      );
    }
    idToIndex.set(id, i);
  }
  for (let i = 0; i < runEvents.length; i++) {
    const ev = runEvents[i]!;
    if (ev.schemaVersion !== 2) continue;
    const p = ev.parentRunEventId;
    if (p === undefined) continue;
    const pi = idToIndex.get(p);
    if (pi === undefined) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.TRACE_UNKNOWN_PARENT_RUN_EVENT_ID,
        `Unknown parentRunEventId: ${p}`,
      );
    }
    if (pi >= i) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.TRACE_PARENT_FORWARD_REFERENCE,
        `parentRunEventId must reference a strictly earlier event; offending child index ${i}, parent index ${pi}.`,
      );
    }
  }
}

export type BuildExecutionTraceViewInput = {
  workflowId: string;
  runEvents: RunEvent[];
  malformedEventLineCount: number;
  workflowResult?: WorkflowResult | null;
};

function toolIngestIndicesBySeq(runEvents: RunEvent[]): Map<number, number[]> {
  const m = new Map<number, number[]>();
  for (let ingestIndex = 0; ingestIndex < runEvents.length; ingestIndex++) {
    const ev = runEvents[ingestIndex]!;
    if (!isToolObservedRunEvent(ev)) continue;
    const list = m.get(ev.seq) ?? [];
    list.push(ingestIndex);
    m.set(ev.seq, list);
  }
  return m;
}

function deriveTraceStepKind(
  ev: RunEvent,
  ingestIndex: number,
  seqToLastToolIngest: Map<number, number>,
  planBySeq: Map<
    number,
    { divergent: boolean; repeatObservationCount: number }
  >,
  verificationLink: ExecutionTraceVerificationLink | null,
  hasWorkflowResult: boolean,
): TraceStepKind {
  if (ev.type === "tool_skipped") {
    return "skipped";
  }
  if (ev.type === "control") {
    const c = ev as ControlRunEvent;
    if ((c.controlKind === "branch" || c.controlKind === "gate") && c.decision === "taken") {
      return "branch_taken";
    }
    if ((c.controlKind === "branch" || c.controlKind === "gate") && c.decision === "skipped") {
      return "branch_skipped";
    }
    if (c.controlKind === "interrupt") return "failed";
    if (c.controlKind === "run_completed") return "success";
    if (c.controlKind === "loop") return "neutral";
    return "neutral";
  }
  if (ev.type === "model_turn") {
    const m = ev as ModelTurnRunEvent;
    if (m.status === "error") return "failed";
    if (m.status === "completed") return "success";
    if (m.status === "aborted" || m.status === "incomplete") return "failed";
    return "neutral";
  }
  if (ev.type === "retrieval") {
    const r = ev as RetrievalRunEvent;
    if (r.status === "error") return "failed";
    if (r.status === "ok") return "success";
    if (r.status === "empty") return "neutral";
    return "neutral";
  }
  if (ev.type === "tool_observed") {
    const seq = ev.seq;
    const lastIngest = seqToLastToolIngest.get(seq);
    const isLastForSeq = lastIngest === ingestIndex;
    const plan = planBySeq.get(seq);
    if (plan?.divergent && isLastForSeq) {
      return "divergent_observations";
    }
    if (plan && plan.repeatObservationCount > 1 && !isLastForSeq) {
      return "repeated_observation";
    }
    if (isLastForSeq && verificationLink?.engineStepStatus === "verified") {
      return "success";
    }
    if (isLastForSeq && verificationLink !== null && verificationLink.engineStepStatus !== "verified") {
      return "failed";
    }
    if (isLastForSeq && !hasWorkflowResult) {
      return "neutral";
    }
    return "neutral";
  }
  return "neutral";
}

function nodeRunEventId(ev: RunEvent, ingestIndex: number): string {
  if (ev.schemaVersion === 2) {
    return ev.runEventId;
  }
  return `syn:${ingestIndex}`;
}

function resolvedParentRunEventId(ev: RunEvent, ingestIndex: number): string | null {
  if (ev.schemaVersion !== 2) return null;
  if (ev.parentRunEventId === undefined) return null;
  return ev.parentRunEventId;
}

function buildAncestorChain(seedId: string, idToNode: Map<string, ExecutionTraceNode>): string[] {
  const chain: string[] = [];
  let cur: string | null = seedId;
  const visited = new Set<string>();
  while (cur !== null) {
    if (visited.has(cur)) break;
    visited.add(cur);
    chain.push(cur);
    const n = idToNode.get(cur);
    cur = n?.parentRunEventId ?? null;
  }
  return chain;
}

export function buildExecutionTraceView(input: BuildExecutionTraceViewInput): ExecutionTraceView {
  const { workflowId, runEvents, malformedEventLineCount, workflowResult } = input;
  assertValidRunEventParentGraph(runEvents);

  const tools = runEvents.filter(isToolObservedRunEvent);
  const plans = planLogicalSteps(tools);
  const planBySeq = new Map(plans.map((p) => [p.seq, { divergent: p.divergent, repeatObservationCount: p.repeatObservationCount }]));

  const seqToLastToolIngest = new Map<number, number>();
  const bySeq = toolIngestIndicesBySeq(runEvents);
  for (const [seq, indices] of bySeq) {
    const last = indices[indices.length - 1];
    if (last !== undefined) seqToLastToolIngest.set(seq, last);
  }

  const hasWr = workflowResult !== undefined && workflowResult !== null;
  const verificationLinkByIngest = new Map<number, ExecutionTraceVerificationLink | null>();

  if (hasWr && workflowResult) {
    if (workflowResult.workflowId !== workflowId) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
        `WorkflowResult.workflowId (${workflowResult.workflowId}) does not match trace workflowId (${workflowId}).`,
      );
    }
    const wr = workflowResult;
    for (let stepIndex = 0; stepIndex < wr.steps.length; stepIndex++) {
      const step = wr.steps[stepIndex]!;
      const seq = step.seq;
      const lastIngest = seqToLastToolIngest.get(seq);
      if (lastIngest === undefined) continue;
      const truthStep = wr.workflowTruthReport.steps[stepIndex];
      const truthOutcomeLabel = truthStep?.outcomeLabel ?? "UNKNOWN";
      verificationLinkByIngest.set(lastIngest, {
        stepIndex,
        seq,
        engineStepStatus: step.status,
        truthOutcomeLabel,
      });
    }
  }

  const nodes: ExecutionTraceNode[] = [];
  for (let ingestIndex = 0; ingestIndex < runEvents.length; ingestIndex++) {
    const ev = runEvents[ingestIndex]!;
    const vLink = verificationLinkByIngest.get(ingestIndex) ?? null;
    const traceStepKind = deriveTraceStepKind(
      ev,
      ingestIndex,
      seqToLastToolIngest,
      planBySeq,
      vLink,
      hasWr,
    );
    const wireType = ev.type;
    const wireSchemaVersion = ev.schemaVersion as 1 | 2;
    let toolSeq: number | null = null;
    let toolId: string | null = null;
    if (wireType === "tool_observed") {
      toolSeq = ev.seq;
      toolId = ev.toolId;
    } else if (wireType === "tool_skipped") {
      toolId = (ev as ToolSkippedRunEvent).toolId;
    }
    const verificationLink =
      wireType === "tool_observed" && seqToLastToolIngest.get(ev.seq) === ingestIndex ? vLink : null;

    nodes.push({
      ingestIndex,
      runEventId: nodeRunEventId(ev, ingestIndex),
      wireSchemaVersion,
      wireType,
      parentRunEventId: resolvedParentRunEventId(ev, ingestIndex),
      traceStepKind,
      toolSeq,
      toolId,
      verificationLink,
    });
  }

  let runCompletion: "completed" | "unknown_or_interrupted" = "unknown_or_interrupted";
  if (nodes.length > 0) {
    const last = nodes[nodes.length - 1]!;
    const ev = runEvents[last.ingestIndex]!;
    if (
      ev.type === "control" &&
      (ev as ControlRunEvent).controlKind === "run_completed"
    ) {
      runCompletion = "completed";
    }
  }

  const idToNode = new Map(nodes.map((n) => [n.runEventId, n]));
  const backwardPaths: ExecutionTraceBackwardPath[] = [];

  if (nodes.length > 0) {
    const lastNode = nodes[nodes.length - 1]!;
    backwardPaths.push({
      pathKind: "workflow_terminal",
      seedRunEventId: lastNode.runEventId,
      ancestorRunEventIds: buildAncestorChain(lastNode.runEventId, idToNode),
    });
  }

  if (hasWr && workflowResult) {
    for (let stepIndex = 0; stepIndex < workflowResult.steps.length; stepIndex++) {
      const step = workflowResult.steps[stepIndex]!;
      const seq = step.seq;
      const lastIngest = seqToLastToolIngest.get(seq);
      if (lastIngest === undefined) continue;
      const seedNode = nodes[lastIngest]!;
      backwardPaths.push({
        pathKind: "verification_step",
        seedRunEventId: seedNode.runEventId,
        ancestorRunEventIds: buildAncestorChain(seedNode.runEventId, idToNode),
        stepIndex,
        seq,
      });
    }
  }

  return {
    schemaVersion: 1,
    workflowId,
    runCompletion,
    malformedEventLineCount,
    nodes,
    backwardPaths,
  };
}

export function formatExecutionTraceText(view: ExecutionTraceView): string {
  const lines: string[] = [];
  lines.push(`workflowId=${view.workflowId}`);
  lines.push(`runCompletion=${view.runCompletion}`);
  lines.push(`malformedEventLineCount=${view.malformedEventLineCount}`);
  lines.push("nodes:");
  for (const n of view.nodes) {
    const v = n.verificationLink
      ? ` step=${n.verificationLink.stepIndex} engineStatus=${n.verificationLink.engineStepStatus} truth=${n.verificationLink.truthOutcomeLabel}`
      : "";
    lines.push(
      `  [${n.ingestIndex}] id=${n.runEventId} type=${n.wireType} kind=${n.traceStepKind} parent=${n.parentRunEventId ?? "null"} seq=${n.toolSeq ?? "-"}${v}`,
    );
  }
  lines.push("backwardPaths:");
  for (const p of view.backwardPaths) {
    if (p.pathKind === "workflow_terminal") {
      lines.push(`  workflow_terminal seed=${p.seedRunEventId} chain=${p.ancestorRunEventIds.join(" -> ")}`);
    } else {
      lines.push(
        `  verification_step stepIndex=${p.stepIndex} seq=${p.seq} seed=${p.seedRunEventId} chain=${p.ancestorRunEventIds.join(" -> ")}`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
