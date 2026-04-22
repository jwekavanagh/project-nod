import path from "node:path";
import { isToolObservedRunEvent } from "./executionTrace.js";
import { loadToolsRegistry, verifyRunStateFromEvents } from "./pipeline.js";
import { prepareWorkflowEvents } from "./prepareWorkflowEvents.js";
import type {
  Reason,
  RunEvent,
  ToolObservedEvent,
  VerificationDatabase,
  VerificationPolicy,
  WorkflowResult,
} from "./types.js";

export type VerifyRunStateFromBufferedRunEventsInput = {
  workflowId: string;
  registryPath: string;
  database: VerificationDatabase;
  projectRoot: string;
  bufferedRunEvents: RunEvent[];
  runLevelReasons: Reason[];
  verificationPolicy: VerificationPolicy;
  logStep?: (line: object) => void;
  truthReport?: (report: string) => void;
};

/**
 * Single shared path: buffered run events + registry + DB → `WorkflowResult`.
 * Used by `createDecisionGate` and `createLangGraphCheckpointTrustGate.runCheckpointTrust` (eligible path only).
 */
export async function verifyRunStateFromBufferedRunEvents(
  input: VerifyRunStateFromBufferedRunEventsInput,
): Promise<WorkflowResult> {
  const projectRoot = path.resolve(input.projectRoot);
  const registryPath = path.resolve(projectRoot, input.registryPath);
  const logStep = input.logStep ?? (() => {});
  const truthReport = input.truthReport ?? (() => {});

  if (!input.bufferedRunEvents.length && !input.runLevelReasons.length) {
    throw new Error("verifyRunStateFromBufferedRunEvents: empty buffer and no run-level reasons");
  }

  if (!input.bufferedRunEvents.length) {
    const registry = loadToolsRegistry(registryPath);
    return verifyRunStateFromEvents({
      workflowId: input.workflowId,
      events: [],
      runEvents: [],
      runLevelReasons: [...input.runLevelReasons],
      eventSequenceIntegrity: { kind: "normal" },
      eventFileAggregateCounts: {
        eventFileNonEmptyLines: 0,
        schemaValidEvents: 0,
        toolObservedForRequestedWorkflowId: 0,
        toolObservedForOtherWorkflowIds: 0,
      },
      registry,
      database: input.database,
      verificationPolicy: input.verificationPolicy,
      logStep,
      truthReport,
    });
  }

  const toolCandidates: ToolObservedEvent[] = [];
  for (const ev of input.bufferedRunEvents) {
    if (isToolObservedRunEvent(ev)) {
      toolCandidates.push(ev);
    }
  }
  const { eventsSorted, eventSequenceIntegrity } = prepareWorkflowEvents(toolCandidates);
  const registry = loadToolsRegistry(registryPath);
  return verifyRunStateFromEvents({
    workflowId: input.workflowId,
    events: eventsSorted,
    runEvents: input.bufferedRunEvents,
    runLevelReasons: [...input.runLevelReasons],
    eventSequenceIntegrity,
    eventFileAggregateCounts: {
      eventFileNonEmptyLines: 0,
      schemaValidEvents: 0,
      toolObservedForRequestedWorkflowId: toolCandidates.length,
      toolObservedForOtherWorkflowIds: 0,
    },
    registry,
    database: input.database,
    verificationPolicy: input.verificationPolicy,
    logStep,
    truthReport,
  });
}
