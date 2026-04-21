import { createHash } from "node:crypto";

export const WORKFLOW_RESULT_RELATIVE = "workflow-result.json";
export const EVENTS_RELATIVE = "events.ndjson";
export const WORKFLOW_RESULT_SIGNATURE_RELATIVE = "workflow-result.sig.json";

/** On-disk corpus / run-bundle filenames (same strings as manifest `relativePath` fields). */
export const AGENT_RUN_FILENAME = "agent-run.json";
export const EVENTS_FILENAME = EVENTS_RELATIVE;
export const WORKFLOW_RESULT_FILENAME = WORKFLOW_RESULT_RELATIVE;
export const WORKFLOW_RESULT_SIG_FILENAME = WORKFLOW_RESULT_SIGNATURE_RELATIVE;

export type ArtifactSpec = {
  relativePath: string;
  sha256: string;
  byteLength: number;
};

/** Unsigned manifest; matches `agent-run-record-v1.schema.json`. */
export type AgentRunRecordV1 = {
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

/** Signed manifest; matches `agent-run-record-v2.schema.json`. */
export type AgentRunRecordV2 = {
  schemaVersion: 2;
  runId: string;
  workflowId: string;
  producer: { name: string; version: string };
  verifiedAt: string;
  customerId?: string;
  capturedAt?: string;
  artifacts: {
    workflowResult: { relativePath: typeof WORKFLOW_RESULT_RELATIVE; sha256: string; byteLength: number };
    events: { relativePath: typeof EVENTS_RELATIVE; sha256: string; byteLength: number };
    workflowResultSignature: {
      relativePath: typeof WORKFLOW_RESULT_SIGNATURE_RELATIVE;
      sha256: string;
      byteLength: number;
    };
  };
};

export type AgentRunRecord = AgentRunRecordV1 | AgentRunRecordV2;

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
  /** When set, emit schemaVersion 2 with signature artifact. */
  workflowResultSignatureBytes?: Buffer;
  customerId?: string;
  capturedAt?: string;
};

export function buildAgentRunRecordForBundle(input: BuildAgentRunRecordInput): AgentRunRecord {
  const base = {
    runId: input.runId,
    workflowId: input.workflowId,
    producer: input.producer,
    verifiedAt: input.verifiedAt,
    ...(input.customerId !== undefined && input.customerId !== "" ? { customerId: input.customerId } : {}),
    ...(input.capturedAt !== undefined && input.capturedAt !== "" ? { capturedAt: input.capturedAt } : {}),
  };

  const workflowResult: AgentRunRecordV1["artifacts"]["workflowResult"] = {
    relativePath: WORKFLOW_RESULT_RELATIVE,
    sha256: sha256Hex(input.workflowResultBytes),
    byteLength: input.workflowResultBytes.length,
  };
  const events: AgentRunRecordV1["artifacts"]["events"] = {
    relativePath: EVENTS_RELATIVE,
    sha256: sha256Hex(input.eventsBytes),
    byteLength: input.eventsBytes.length,
  };

  const sigBytes = input.workflowResultSignatureBytes;
  if (sigBytes !== undefined) {
    const rec: AgentRunRecordV2 = {
      ...base,
      schemaVersion: 2,
      artifacts: {
        workflowResult,
        events,
        workflowResultSignature: {
          relativePath: WORKFLOW_RESULT_SIGNATURE_RELATIVE,
          sha256: sha256Hex(sigBytes),
          byteLength: sigBytes.length,
        } satisfies AgentRunRecordV2["artifacts"]["workflowResultSignature"],
      },
    };
    return rec;
  }

  const rec: AgentRunRecordV1 = {
    ...base,
    schemaVersion: 1,
    artifacts: { workflowResult, events },
  };
  return rec;
}
