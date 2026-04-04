import { createHash } from "node:crypto";

export const WORKFLOW_RESULT_RELATIVE = "workflow-result.json";
export const EVENTS_RELATIVE = "events.ndjson";

/** Canonical manifest (`agent-run.json`) shape; matches `agent-run-record.schema.json`. */
export type AgentRunRecord = {
  schemaVersion: 1;
  runId: string;
  workflowId: string;
  producer: { name: string; version: string };
  verifiedAt: string;
  customerId?: string;
  capturedAt?: string;
  artifacts: {
    workflowResult: { relativePath: typeof WORKFLOW_RESULT_RELATIVE; sha256: string; byteLength: number };
    events: { relativePath: typeof EVENTS_RELATIVE; sha256: string; byteLength: number };
  };
};

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type BuildAgentRunRecordInput = {
  runId: string;
  workflowId: string;
  producer: { name: string; version: string };
  verifiedAt: string;
  workflowResultBytes: Buffer;
  eventsBytes: Buffer;
  customerId?: string;
  capturedAt?: string;
};

export function buildAgentRunRecordForBundle(input: BuildAgentRunRecordInput): AgentRunRecord {
  return {
    schemaVersion: 1,
    runId: input.runId,
    workflowId: input.workflowId,
    producer: input.producer,
    verifiedAt: input.verifiedAt,
    ...(input.customerId !== undefined && input.customerId !== "" ? { customerId: input.customerId } : {}),
    ...(input.capturedAt !== undefined && input.capturedAt !== "" ? { capturedAt: input.capturedAt } : {}),
    artifacts: {
      workflowResult: {
        relativePath: WORKFLOW_RESULT_RELATIVE,
        sha256: sha256Hex(input.workflowResultBytes),
        byteLength: input.workflowResultBytes.length,
      },
      events: {
        relativePath: EVENTS_RELATIVE,
        sha256: sha256Hex(input.eventsBytes),
        byteLength: input.eventsBytes.length,
      },
    },
  };
}
