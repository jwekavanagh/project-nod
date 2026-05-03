/**
 * Unified failure spine v1 — certificate.failureSpine JSON + human failure_spine block source.
 */

import { deriveActionableFailureWorkflow } from "./actionableFailure.js";
import { workflowResultToEngineSlice } from "./evidenceCompleteness.js";
import { buildFailureAnalysis } from "./failureAnalysis.js";
import type { QuickVerifyReport } from "./quickVerify/runQuickVerify.js";
import { remediationMessageForRecommendedAction } from "./remediationMessage.js";
import { redactEvidenceString } from "./redactEvidenceString.js";
import type { TrustDecision } from "./trustDecision.js";
import { trustDecisionFromRelianceFields } from "./trustDecision.js";
import type {
  ActionableFailure,
  FailureAnalysisBase,
  Reason,
  StepOutcome,
  WorkflowEngineResult,
  WorkflowResult,
  WorkflowStatus,
} from "./types.js";
import type {
  OutcomeCertificateHighStakesReliance,
  OutcomeCertificateStateRelation,
} from "./outcomeCertificate.js";
import { DEFAULT_VERIFICATION_POLICY } from "./verificationPolicy.js";
import { createEmptyVerificationRunContext } from "./verificationRunContext.js";
import { SQL_VERIFICATION_OUTCOME_CODE } from "./wireReasonCodes.js";

export type FailureSpineSource = "workflow" | "quick" | "ineligible_langgraph";

export type FailureSpineV1 = {
  schemaVersion: 1;
  trustDecision: TrustDecision;
  summary: string;
  actionableFailure: ActionableFailure;
  primaryCodes: string[];
  rerunGuidance: string;
  source: FailureSpineSource;
};

function sortUniqueCodes(codes: string[]): string[] {
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b));
}

function collectWorkflowCodes(result: WorkflowResult): Set<string> {
  const s = new Set<string>();
  for (const r of result.runLevelReasons) s.add(r.code);
  if (result.eventSequenceIntegrity.kind === "irregular") {
    for (const r of result.eventSequenceIntegrity.reasons) s.add(r.code);
  }
  for (const step of result.steps) {
    for (const r of step.reasons) s.add(r.code);
  }
  return s;
}

function syntheticFailureBase(result: WorkflowResult): FailureAnalysisBase {
  const codes = [...collectWorkflowCodes(result)].sort((a, b) => a.localeCompare(b)).slice(0, 12);
  return {
    summary: "Synthetic failure analysis for evidence completeness fallback.",
    primaryOrigin: "workflow_flow",
    confidence: "medium",
    unknownReasonCodes: [] as string[],
    evidence:
      codes.length > 0
        ? [{ scope: "run_level" as const, codes }]
        : [{ scope: "step" as const, codes: ["UNCLASSIFIED_GAP"], seq: 0, toolId: "" }],
    alternativeHypotheses: undefined,
  };
}

function primaryCodesForWorkflowResult(result: WorkflowResult): string[] {
  const fa = result.workflowTruthReport.failureAnalysis;
  if (fa !== null) {
    const c0 = fa.evidence[0]?.codes;
    if (c0?.length) return sortUniqueCodes([...c0]).slice(0, 24);
    return ["UNCLASSIFIED"];
  }
  const all = [...collectWorkflowCodes(result)];
  return all.length ? sortUniqueCodes(all).slice(0, 24) : ["UNCLASSIFIED"];
}

export function buildFailureSpineFromWorkflowResult(params: {
  result: WorkflowResult;
  runKind: "contract_sql" | "contract_sql_langgraph_checkpoint_trust";
  stateRelation: OutcomeCertificateStateRelation;
  highStakesReliance: OutcomeCertificateHighStakesReliance;
}): FailureSpineV1 {
  const { result, runKind, stateRelation, highStakesReliance } = params;
  const truth = result.workflowTruthReport;
  const engineSlice = workflowResultToEngineSlice(result);

  let actionableFailure: ActionableFailure;
  let summary: string;

  if (truth.failureAnalysis !== null) {
    actionableFailure = truth.failureAnalysis.actionableFailure;
    summary = truth.failureAnalysis.summary;
  } else {
    const base = syntheticFailureBase(result);
    actionableFailure = deriveActionableFailureWorkflow(engineSlice, base);
    summary = truth.trustSummary;
  }

  const trustDecision = trustDecisionFromRelianceFields({
    runKind,
    stateRelation,
    highStakesReliance,
  });

  const rerunGuidance = redactEvidenceString(
    remediationMessageForRecommendedAction(actionableFailure.recommendedAction),
    500,
  );

  return {
    schemaVersion: 1,
    trustDecision,
    summary,
    actionableFailure,
    primaryCodes: primaryCodesForWorkflowResult(result),
    rerunGuidance,
    source: "workflow",
  };
}

function quickVerifyReportToSyntheticEngine(report: QuickVerifyReport, workflowId: string): WorkflowEngineResult {
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

function primaryCodesQuick(report: QuickVerifyReport): string[] {
  const codes: string[] = [];
  for (const u of report.units) {
    if (u.verdict !== "verified") {
      codes.push(`quick_unit_${u.verdict}`);
    }
  }
  return codes.length ? sortUniqueCodes(codes) : ["UNCLASSIFIED"];
}

function syntheticQuickFailureAnalysis(report: QuickVerifyReport): FailureAnalysisBase {
  return {
    summary: report.summary,
    primaryOrigin: "workflow_flow",
    confidence: "medium",
    unknownReasonCodes: [],
    evidence: [{ scope: "run_level", codes: ["QUICK_PREVIEW_SYNTHETIC"] }],
    alternativeHypotheses: undefined,
  };
}

export function buildFailureSpineFromQuickReport(params: {
  report: QuickVerifyReport;
  workflowId: string;
  stateRelation: OutcomeCertificateStateRelation;
  highStakesReliance: OutcomeCertificateHighStakesReliance;
}): FailureSpineV1 {
  const engine = quickVerifyReportToSyntheticEngine(params.report, params.workflowId);
  const fa = buildFailureAnalysis(engine);
  let actionableFailure: ActionableFailure;
  if (fa !== null) {
    actionableFailure = deriveActionableFailureWorkflow(engine, fa);
  } else {
    actionableFailure = deriveActionableFailureWorkflow(engine, syntheticQuickFailureAnalysis(params.report));
  }

  const trustDecision = trustDecisionFromRelianceFields({
    runKind: "quick_preview",
    stateRelation: params.stateRelation,
    highStakesReliance: params.highStakesReliance,
  });

  const rerunGuidance = redactEvidenceString(
    remediationMessageForRecommendedAction(actionableFailure.recommendedAction),
    500,
  );

  return {
    schemaVersion: 1,
    trustDecision,
    summary: params.report.summary,
    actionableFailure,
    primaryCodes: primaryCodesQuick(params.report),
    rerunGuidance,
    source: "quick",
  };
}

export function buildFailureSpineFromIneligibleLangGraph(params: {
  workflowId: string;
  runLevelReasons: Reason[];
  headline: string;
  stateRelation: OutcomeCertificateStateRelation;
  highStakesReliance: OutcomeCertificateHighStakesReliance;
}): FailureSpineV1 {
  const engine: WorkflowEngineResult = {
    schemaVersion: 8,
    workflowId: params.workflowId,
    status: "incomplete",
    runLevelReasons: params.runLevelReasons,
    verificationPolicy: DEFAULT_VERIFICATION_POLICY,
    eventSequenceIntegrity: { kind: "normal" },
    steps: [],
    verificationRunContext: createEmptyVerificationRunContext(),
  };

  const fa = buildFailureAnalysis(engine);
  const base: FailureAnalysisBase = {
    summary: params.headline,
    primaryOrigin: "workflow_flow",
    confidence: "low",
    unknownReasonCodes: [],
    evidence:
      params.runLevelReasons.length > 0
        ? [{ scope: "run_level", codes: params.runLevelReasons.map((r) => r.code) }]
        : [{ scope: "run_level", codes: ["LANGGRAPH_INELIGIBLE"] }],
    alternativeHypotheses: undefined,
  };

  const actionableFailure =
    fa !== null ? deriveActionableFailureWorkflow(engine, fa) : deriveActionableFailureWorkflow(engine, base);

  const trustDecision = trustDecisionFromRelianceFields({
    runKind: "contract_sql_langgraph_checkpoint_trust",
    stateRelation: params.stateRelation,
    highStakesReliance: params.highStakesReliance,
  });

  const rerunGuidance = redactEvidenceString(
    remediationMessageForRecommendedAction(actionableFailure.recommendedAction),
    500,
  );

  let primaryCodes: string[];
  if (params.runLevelReasons.length > 0) {
    primaryCodes = sortUniqueCodes(params.runLevelReasons.map((r) => r.code)).slice(0, 24);
  } else {
    primaryCodes = ["LANGGRAPH_INELIGIBLE"];
  }

  return {
    schemaVersion: 1,
    trustDecision,
    summary: params.headline,
    actionableFailure,
    primaryCodes,
    rerunGuidance,
    source: "ineligible_langgraph",
  };
}
