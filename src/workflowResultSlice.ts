/**
 * Workflow engine slice without truth report — breaks import cycle between evidence and failure spine.
 */

import type { WorkflowEngineResult, WorkflowResult } from "./types.js";

export function workflowResultToEngineSlice(result: WorkflowResult): WorkflowEngineResult {
  const { workflowTruthReport: _omit, schemaVersion: _sv, ...rest } = result;
  return { ...rest, schemaVersion: 8 };
}
