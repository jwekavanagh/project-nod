import { compareUtf16Id } from "../resolveExpectation.js";
import type { VerificationRequest } from "../types.js";

export type QuickContractExport =
  | { toolId: string; kind: "sql_row"; request: VerificationRequest }
  | { toolId: string; kind: "related_exists_export" };

/**
 * Synthetic tool_observed NDJSON (schemaVersion 1) for contract replay.
 * Empty exports → caller writes a zero-byte file (no trailing newline).
 * Exports are sorted by toolId (UTF-16) before assigning seq 0..n-1.
 */
export function buildQuickContractEventsNdjson(input: {
  workflowId: string;
  exports: QuickContractExport[];
}): string {
  if (input.exports.length === 0) return "";
  const sorted = [...input.exports].sort((a, b) => compareUtf16Id(a.toolId, b.toolId));
  const lines: string[] = [];
  for (let seq = 0; seq < sorted.length; seq++) {
    const exp = sorted[seq]!;
    if (exp.kind === "related_exists_export") {
      lines.push(
        JSON.stringify({
          schemaVersion: 1,
          workflowId: input.workflowId,
          seq,
          type: "tool_observed",
          toolId: exp.toolId,
          params: {},
        }),
      );
    } else {
      const __qvFields: Record<string, string | number | boolean | null> = {};
      for (const k of Object.keys(exp.request.requiredFields).sort(compareUtf16Id)) {
        __qvFields[k] = exp.request.requiredFields[k]!;
      }
      lines.push(
        JSON.stringify({
          schemaVersion: 1,
          workflowId: input.workflowId,
          seq,
          type: "tool_observed",
          toolId: exp.toolId,
          params: { __qvFields },
        }),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
