/**
 * Synthetic WorkflowEngineResult from Quick Verify report — failure spine + remediation derivation.
 */

import { createEmptyVerificationRunContext } from "./verificationRunContext.js";
import { DEFAULT_VERIFICATION_POLICY } from "./verificationPolicy.js";
import { SQL_VERIFICATION_OUTCOME_CODE } from "./wireReasonCodes.js";
import type { QuickVerifyReport } from "./quickVerify/runQuickVerify.js";
import type { FailureAnalysisBase, Reason, StepOutcome, WorkflowEngineResult, WorkflowStatus } from "./types.js";

export function quickVerifyReportToSyntheticEngine(report: QuickVerifyReport, workflowId: string): WorkflowEngineResult {
  const status: WorkflowStatus =
    report.verdict === "fail" ? "inconsistent" : report.verdict === "pass" ? "complete" : "incomplete";

  const steps: StepOutcome[] = report.units.map((u, i) => {
    const st =
      u.verdict === "verified" ? "verified" : u.verdict === "fail" ? "inconsistent" : "uncertain";
    const reasons: Reason[] =
      u.reasonCodes.length > 0
        ? u.reasonCodes.map((c) => ({ code: c, message: c }))
        : u.verdict !== "verified"
          ? [{ code: SQL_VERIFICATION_OUTCOME_CODE.ROW_ABSENT, message: "quick synthetic absent" }]
          : [];
    const step: StepOutcome = {
      releaseCritical: false,
      seq: i,
      toolId: u.sourceAction.toolName,
      intendedEffect: { narrative: u.explanation },
      observedExecution: { paramsCanonical: "{}" },
      verificationRequest: {
        kind: "sql_row",
        table: u.inference.table,
        identityEq: [{ column: "id", value: "quick_synthetic" }],
        requiredFields: {},
      },
      status: st,
      reasons,
      evidenceSummary: {},
      repeatObservationCount: 1,
      evaluatedObservationOrdinal: 1,
    };
    if (st !== "verified") {
      step.failureDiagnostic = "workflow_execution";
    }
    return step;
  });

  return {
    schemaVersion: 8,
    workflowId,
    status,
    runLevelReasons: [],
    verificationPolicy: DEFAULT_VERIFICATION_POLICY,
    eventSequenceIntegrity: { kind: "normal" },
    steps,
    verificationRunContext: createEmptyVerificationRunContext(),
  };
}

export function syntheticQuickFailureAnalysis(report: QuickVerifyReport): FailureAnalysisBase {
  return {
    summary: report.summary,
    primaryOrigin: "workflow_flow",
    confidence: "medium",
    unknownReasonCodes: [],
    evidence: [{ scope: "run_level", codes: ["QUICK_PREVIEW_SYNTHETIC"] }],
    alternativeHypotheses: undefined,
  };
}
