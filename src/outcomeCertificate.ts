import type { QuickVerifyReport } from "./quickVerify/runQuickVerify.js";
import { formatQuickVerifyHumanReport } from "./quickVerify/formatQuickVerifyHumanReport.js";
import {
  buildEvidenceCompletenessForIneligibleLangGraph,
  buildEvidenceCompletenessFromQuickReport,
  buildEvidenceCompletenessFromWorkflowResult,
  type EvidenceCompletenessJson,
} from "./evidenceCompleteness.js";
import {
  EVIDENCE_COMPLETENESS_BEGIN,
  formatEvidenceCompletenessHuman,
} from "./formatEvidenceCompletenessHuman.js";
import {
  buildFailureSpineFromIneligibleLangGraph,
  buildFailureSpineFromQuickReport,
  buildFailureSpineFromWorkflowResult,
  type FailureSpineV1,
} from "./failureSpine.js";
import { formatFailureSpineHuman } from "./formatFailureSpineHuman.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import {
  deriveRemediationDecisionFromQuickReport,
  deriveRemediationDecisionFromWorkflowResult,
} from "./actionableFailure.js";
import type { CorrectnessDefinitionV1, Reason, StepOutcome, WorkflowResult, WorkflowTruthStep } from "./types.js";
import { formatWorkflowTruthReportStruct } from "./workflowTruthReport.js";

export type OutcomeCertificateRunKind =
  | "contract_sql"
  | "contract_sql_langgraph_checkpoint_trust"
  | "quick_preview";

export type OutcomeCertificateStateRelation =
  | "matches_expectations"
  | "does_not_match"
  | "not_established";

export type OutcomeCertificateHighStakesReliance = "permitted" | "prohibited";

export type OutcomeCertificateExplanationDetail = {
  code: string;
  message: string;
};

export type OutcomeCertificateStep = {
  seq: number;
  toolId?: string;
  declaredAction: string;
  expectedOutcome: string;
  observedOutcome: string;
};

export type OutcomeCertificateCheckpointVerdict = {
  checkpointKey: string;
  verdict: "verified" | "inconsistent" | "incomplete";
  seqs: number[];
  productionMeaning: string;
};

/**
 * Normative JSON shape: schemas/outcome-certificate-v3.schema.json (`schemaVersion` 3 + `failureSpine` + `evidenceCompleteness`).
 */
export type OutcomeCertificateV3 = {
  schemaVersion: 3;
  workflowId: string;
  runKind: OutcomeCertificateRunKind;
  stateRelation: OutcomeCertificateStateRelation;
  highStakesReliance: OutcomeCertificateHighStakesReliance;
  relianceRationale: string;
  intentSummary: string;
  explanation: {
    headline: string;
    details: OutcomeCertificateExplanationDetail[];
  };
  steps: OutcomeCertificateStep[];
  humanReport: string;
  evidenceCompleteness: EvidenceCompletenessJson;
  failureSpine: FailureSpineV1;
  checkpointVerdicts?: OutcomeCertificateCheckpointVerdict[];
  /** Mirrors `workflowTruthReport.correctnessDefinition` when present (optional attestation field). */
  correctnessDefinition?: CorrectnessDefinitionV1 | null;
};

/** @deprecated Use OutcomeCertificateV3 — alias retained for semver-stable imports */
export type OutcomeCertificateV2 = OutcomeCertificateV3;
/** @deprecated Use OutcomeCertificateV3 — alias retained for semver-stable imports */
export type OutcomeCertificateV1 = OutcomeCertificateV3;

export function deriveHighStakesReliance(
  runKind: OutcomeCertificateRunKind,
  stateRelation: OutcomeCertificateStateRelation,
): OutcomeCertificateHighStakesReliance {
  if (runKind === "quick_preview") return "prohibited";
  if (stateRelation === "matches_expectations") return "permitted";
  return "prohibited";
}

export function workflowResultToStateRelation(result: WorkflowResult): OutcomeCertificateStateRelation {
  if (result.status === "complete") return "matches_expectations";
  if (result.status === "inconsistent") return "does_not_match";
  return "not_established";
}

function truthStepToCertificateStep(step: WorkflowTruthStep): OutcomeCertificateStep {
  return {
    seq: step.seq,
    toolId: step.toolId,
    declaredAction: step.intendedEffect.narrative,
    expectedOutcome: step.verifyTarget ?? step.intendedEffect.narrative,
    observedOutcome: step.observedStateSummary,
  };
}

function buildRelianceRationale(
  runKind: OutcomeCertificateRunKind,
  stateRelation: OutcomeCertificateStateRelation,
  highStakesReliance: OutcomeCertificateHighStakesReliance,
): string {
  if (runKind === "quick_preview") {
    return "Quick preview uses inferred, provisional checks. It is never sufficient as the sole basis for high-stakes ship, bill, compliance, or audit-final decisions—even when state appears to match.";
  }
  if (runKind === "contract_sql_langgraph_checkpoint_trust") {
    if (highStakesReliance === "permitted") {
      return "Contract verification used your registry and read-only SQL; every captured step matched declared expectations under the configured rules, and every LangGraph checkpoint rollup verdict is verified. You may treat this artifact as decision-grade for those steps, subject to your own scope and retention policy.";
    }
    if (stateRelation === "does_not_match") {
      return "At least one step failed verification against the database (missing row, wrong values, or partial multi-effect failure), or a LangGraph checkpoint rollup verdict is inconsistent. Do not treat this run as meeting its intended persisted outcome.";
    }
    return "LangGraph checkpoint trust mode did not establish a single approved production snapshot (ineligible wire, incomplete verification, incomplete checkpoint rollup, or sequence integrity). Do not treat absence of a mismatch as proof of success.";
  }
  if (highStakesReliance === "permitted") {
    return "Contract verification used your registry and read-only SQL; every captured step matched declared expectations under the configured rules. You may treat this artifact as decision-grade for those steps, subject to your own scope and retention policy.";
  }
  if (stateRelation === "does_not_match") {
    return "At least one step failed verification against the database (missing row, wrong values, or partial multi-effect failure). Do not treat this run as meeting its intended persisted outcome.";
  }
  return "Verification could not be completed or could not establish a determinate match (incomplete registry, empty capture, indeterminate window, or connector issue). Do not treat absence of a mismatch as proof of success.";
}

function appendEvidenceCompletenessHuman(
  baseHuman: string,
  ec: EvidenceCompletenessJson,
  ctx: { runKind: OutcomeCertificateRunKind; highStakesReliance: OutcomeCertificateHighStakesReliance },
): string {
  return `${baseHuman}\n\n${formatEvidenceCompletenessHuman(ec, ctx)}`;
}

function buildExplanationFromWorkflowResult(result: WorkflowResult): OutcomeCertificateV3["explanation"] {
  const truth = result.workflowTruthReport;
  const details: OutcomeCertificateExplanationDetail[] = [];
  for (const step of truth.steps) {
    for (const r of step.reasons) {
      details.push({ code: r.code, message: r.message });
    }
  }
  for (const r of result.runLevelReasons) {
    details.push({ code: r.code, message: r.message });
  }
  const fe = truth.failureExplanation;
  const headline =
    truth.failureAnalysis?.summary ??
    (fe !== null ? `${fe.divergence} — expected: ${fe.expected}; observed: ${fe.observed}` : truth.trustSummary);
  return { headline, details };
}

function rollupCheckpointGroupVerdict(outcomes: StepOutcome[]): OutcomeCertificateCheckpointVerdict["verdict"] {
  if (outcomes.some((o) => o.status === "incomplete_verification")) return "incomplete";
  if (
    outcomes.some(
      (o) =>
        o.status === "missing" || o.status === "inconsistent" || o.status === "partially_verified",
    )
  ) {
    return "inconsistent";
  }
  if (outcomes.every((o) => o.status === "verified")) return "verified";
  return "incomplete";
}

function checkpointProductionMeaning(
  verdict: OutcomeCertificateCheckpointVerdict["verdict"],
): string {
  if (verdict === "verified") {
    return "Production may advance under this checkpoint identity.";
  }
  if (verdict === "inconsistent") {
    return "Do not advance production for this checkpoint identity until traces and database agree.";
  }
  return "Verification is incomplete for this checkpoint identity; production gate remains closed.";
}

export function computeCheckpointVerdictsFromWorkflowResult(
  result: WorkflowResult,
): OutcomeCertificateCheckpointVerdict[] {
  const byKey = new Map<string, { seqs: number[]; outcomes: StepOutcome[] }>();
  for (const s of result.steps) {
    if (s.langgraphCheckpointKey === undefined) continue;
    const g = byKey.get(s.langgraphCheckpointKey) ?? { seqs: [], outcomes: [] };
    g.seqs.push(s.seq);
    g.outcomes.push(s);
    byKey.set(s.langgraphCheckpointKey, g);
  }
  const keys = [...byKey.keys()].sort((a, b) => {
    const ea = byKey.get(a)!;
    const eb = byKey.get(b)!;
    const minA = Math.min(...ea.seqs);
    const minB = Math.min(...eb.seqs);
    return minA - minB || a.localeCompare(b);
  });
  return keys.map((key) => {
    const { seqs, outcomes } = byKey.get(key)!;
    const sortedSeqs = [...new Set(seqs)].sort((x, y) => x - y);
    const verdict = rollupCheckpointGroupVerdict(outcomes);
    return {
      checkpointKey: key,
      verdict,
      seqs: sortedSeqs,
      productionMeaning: checkpointProductionMeaning(verdict),
    };
  });
}

/** Exact stderr headline for LangGraph ineligible (A2) terminal contract. */
export const LANGGRAPH_CHECKPOINT_TRUST_INELIGIBLE_HEADLINE =
  "LangGraph checkpoint trust: ineligible" as const;

export function buildIneligibleLangGraphCheckpointTrustCertificate(
  workflowId: string,
  runLevelReasons: Reason[],
): OutcomeCertificateV3 {
  const runKind = "contract_sql_langgraph_checkpoint_trust";
  const stateRelation: OutcomeCertificateStateRelation = "not_established";
  const highStakesReliance = deriveHighStakesReliance(runKind, stateRelation);
  const ineligibleHeadline = LANGGRAPH_CHECKPOINT_TRUST_INELIGIBLE_HEADLINE;
  const details: OutcomeCertificateExplanationDetail[] =
    runLevelReasons.length > 0
      ? runLevelReasons.map((r) => ({ code: r.code, message: r.message }))
      : [
          {
            code: "LANGGRAPH_INELIGIBLE",
            message:
              "No schema-valid schemaVersion 3 tool_observed lines for this workflow in LangGraph checkpoint trust mode.",
          },
        ];
  const humanBase =
    runLevelReasons.length > 0
      ? `${ineligibleHeadline}\n${runLevelReasons.map((r) => `${r.code}: ${r.message}`).join("\n")}`
      : `${ineligibleHeadline}\n${details[0]!.code}: ${details[0]!.message}`;
  const evidenceCompleteness = buildEvidenceCompletenessForIneligibleLangGraph({
    headline: ineligibleHeadline,
    details,
  });
  let humanReport = appendEvidenceCompletenessHuman(humanBase, evidenceCompleteness, {
    runKind,
    highStakesReliance,
  });
  const failureSpine = buildFailureSpineFromIneligibleLangGraph({
    workflowId,
    runLevelReasons,
    headline: ineligibleHeadline,
    stateRelation,
    highStakesReliance,
  });
  humanReport = `${humanReport}\n\n${formatFailureSpineHuman(failureSpine)}`;
  const cert: OutcomeCertificateV3 = {
    schemaVersion: 3,
    workflowId,
    runKind,
    stateRelation,
    highStakesReliance,
    relianceRationale: buildRelianceRationale(runKind, stateRelation, highStakesReliance),
    intentSummary: ineligibleHeadline,
    explanation: { headline: ineligibleHeadline, details },
    steps: [],
    humanReport,
    evidenceCompleteness,
    failureSpine,
  };
  assertOutcomeCertificateInvariants(cert);
  return cert;
}

export function buildOutcomeCertificateLangGraphCheckpointTrustFromWorkflowResult(
  result: WorkflowResult,
): OutcomeCertificateV3 {
  const runKind = "contract_sql_langgraph_checkpoint_trust";
  const stateRelation = workflowResultToStateRelation(result);
  const highStakesReliance = deriveHighStakesReliance(runKind, stateRelation);
  const truth = result.workflowTruthReport;
  const steps = truth.steps.map(truthStepToCertificateStep);
  const checkpointVerdicts = computeCheckpointVerdictsFromWorkflowResult(result);
  const baseHuman = formatWorkflowTruthReportStruct(truth);
  const workflowHuman =
    checkpointVerdicts.length === 0
      ? baseHuman
      : `${baseHuman}\n\nlanggraph_checkpoint_verdicts:\n${checkpointVerdicts
          .map((c) => `${c.checkpointKey}\t${c.verdict}\t${c.productionMeaning}`)
          .join("\n")}`;
  const remediationDecision = deriveRemediationDecisionFromWorkflowResult(result);
  const evidenceCompleteness = buildEvidenceCompletenessFromWorkflowResult(result, remediationDecision);
  let humanReport = appendEvidenceCompletenessHuman(workflowHuman, evidenceCompleteness, {
    runKind,
    highStakesReliance,
  });
  const failureSpine = buildFailureSpineFromWorkflowResult({
    result,
    runKind,
    stateRelation,
    highStakesReliance,
    remediationDecision,
  });
  humanReport = `${humanReport}\n\n${formatFailureSpineHuman(failureSpine)}`;
  const cert: OutcomeCertificateV3 = {
    schemaVersion: 3,
    workflowId: result.workflowId,
    runKind,
    stateRelation,
    highStakesReliance,
    relianceRationale: buildRelianceRationale(runKind, stateRelation, highStakesReliance),
    intentSummary: truth.trustSummary,
    explanation: buildExplanationFromWorkflowResult(result),
    steps,
    humanReport,
    evidenceCompleteness,
    failureSpine,
    checkpointVerdicts,
    ...(truth.correctnessDefinition !== null && truth.correctnessDefinition !== undefined
      ? { correctnessDefinition: truth.correctnessDefinition }
      : {}),
  };
  assertOutcomeCertificateInvariants(cert);
  return cert;
}

/**
 * Build Outcome Certificate from a finalized contract `WorkflowResult` (batch / library verify).
 */
export function buildOutcomeCertificateFromWorkflowResult(
  result: WorkflowResult,
  runKind: "contract_sql",
): OutcomeCertificateV3 {
  const stateRelation = workflowResultToStateRelation(result);
  const highStakesReliance = deriveHighStakesReliance(runKind, stateRelation);
  const truth = result.workflowTruthReport;
  const steps = truth.steps.map(truthStepToCertificateStep);
  const remediationDecision = deriveRemediationDecisionFromWorkflowResult(result);
  const evidenceCompleteness = buildEvidenceCompletenessFromWorkflowResult(result, remediationDecision);
  let humanReport = appendEvidenceCompletenessHuman(formatWorkflowTruthReportStruct(truth), evidenceCompleteness, {
    runKind,
    highStakesReliance,
  });
  const failureSpine = buildFailureSpineFromWorkflowResult({
    result,
    runKind,
    stateRelation,
    highStakesReliance,
    remediationDecision,
  });
  humanReport = `${humanReport}\n\n${formatFailureSpineHuman(failureSpine)}`;
  const cert: OutcomeCertificateV3 = {
    schemaVersion: 3,
    workflowId: result.workflowId,
    runKind,
    stateRelation,
    highStakesReliance,
    relianceRationale: buildRelianceRationale(runKind, stateRelation, highStakesReliance),
    intentSummary: truth.trustSummary,
    explanation: buildExplanationFromWorkflowResult(result),
    steps,
    humanReport,
    evidenceCompleteness,
    failureSpine,
    ...(truth.correctnessDefinition !== null && truth.correctnessDefinition !== undefined
      ? { correctnessDefinition: truth.correctnessDefinition }
      : {}),
  };
  assertOutcomeCertificateInvariants(cert);
  return cert;
}

function quickVerdictToStateRelation(verdict: QuickVerifyReport["verdict"]): OutcomeCertificateStateRelation {
  if (verdict === "pass") return "matches_expectations";
  if (verdict === "fail") return "does_not_match";
  return "not_established";
}

export type BuildQuickOutcomeCertificateOptions = {
  report: QuickVerifyReport;
  workflowId: string;
  humanReportOptions: Parameters<typeof formatQuickVerifyHumanReport>[1];
};

export function buildOutcomeCertificateFromQuickReport(options: BuildQuickOutcomeCertificateOptions): OutcomeCertificateV3 {
  const { report, workflowId, humanReportOptions } = options;
  const runKind = "quick_preview" as const;
  const stateRelation = quickVerdictToStateRelation(report.verdict);
  const highStakesReliance = deriveHighStakesReliance(runKind, stateRelation);
  const remediationDecision = deriveRemediationDecisionFromQuickReport(report, workflowId);
  const evidenceCompleteness = buildEvidenceCompletenessFromQuickReport(
    {
      verdict: report.verdict,
      ingest: report.ingest,
      units: report.units.map((u) => ({
        unitId: u.unitId,
        verdict: u.verdict,
        reasonCodes: u.reasonCodes,
        sourceAction: u.sourceAction,
        reconciliation: u.reconciliation,
        verification: u.verification,
      })),
    },
    remediationDecision,
  );
  let humanReport = appendEvidenceCompletenessHuman(
    formatQuickVerifyHumanReport(report, humanReportOptions),
    evidenceCompleteness,
    { runKind, highStakesReliance },
  );
  const details: OutcomeCertificateExplanationDetail[] = [];
  for (const u of report.units) {
    if (u.verdict !== "verified") {
      details.push({
        code: `quick_unit_${u.verdict}`,
        message: u.reconciliation?.verification_verdict ?? u.verdict,
      });
    }
  }
  const failureSpine = buildFailureSpineFromQuickReport({
    report,
    workflowId,
    stateRelation,
    highStakesReliance,
    remediationDecision,
  });
  humanReport = `${humanReport}\n\n${formatFailureSpineHuman(failureSpine)}`;
  const firstCd = report.units.find((u) => u.correctnessDefinition !== undefined)?.correctnessDefinition;
  const cert: OutcomeCertificateV3 = {
    schemaVersion: 3,
    workflowId,
    runKind,
    stateRelation,
    highStakesReliance,
    relianceRationale: buildRelianceRationale(runKind, stateRelation, highStakesReliance),
    intentSummary: report.summary,
    explanation: {
      headline: report.summary,
      details,
    },
    steps: report.units.map((u, i) => ({
      seq: i,
      declaredAction: `${u.sourceAction.toolName} (unit ${u.unitId})`,
      expectedOutcome: u.reconciliation.expected,
      observedOutcome: u.reconciliation.observed_database,
    })),
    humanReport,
    evidenceCompleteness,
    failureSpine,
    ...(firstCd !== undefined ? { correctnessDefinition: firstCd } : {}),
  };
  assertOutcomeCertificateInvariants(cert);
  return cert;
}

export function formatOutcomeCertificateHuman(certificate: OutcomeCertificateV3): string {
  return certificate.humanReport;
}

/** User-facing truth-check verdict for CLI `agentskeptic check` stderr prefix. */
export type TruthCheckVerdictLabel = "trusted" | "not_trusted" | "unknown";

export function truthCheckVerdictFromCertificate(certificate: OutcomeCertificateV3): TruthCheckVerdictLabel {
  if (certificate.stateRelation === "matches_expectations" && certificate.highStakesReliance === "permitted") {
    return "trusted";
  }
  if (certificate.stateRelation === "does_not_match") {
    return "not_trusted";
  }
  return "unknown";
}

export function assertOutcomeCertificateInvariants(certificate: OutcomeCertificateV3): void {
  const expected = deriveHighStakesReliance(certificate.runKind, certificate.stateRelation);
  if (certificate.schemaVersion !== 3) {
    throw new Error(`outcome_certificate: schemaVersion ${certificate.schemaVersion} !== 3`);
  }
  if (certificate.highStakesReliance !== expected) {
    throw new Error(
      `outcome_certificate: highStakesReliance ${certificate.highStakesReliance} !== derived ${expected} for runKind=${certificate.runKind} stateRelation=${certificate.stateRelation}`,
    );
  }
  if (
    certificate.evidenceCompleteness.schemaVersion !== 1 ||
    certificate.evidenceCompleteness.blockerCategory === undefined
  ) {
    throw new Error("outcome_certificate: evidenceCompleteness malformed");
  }
  if (!certificate.humanReport.includes(EVIDENCE_COMPLETENESS_BEGIN)) {
    throw new Error("outcome_certificate: humanReport must contain evidence_completeness anchors");
  }
  if (formatOutcomeCertificateHuman(certificate) !== certificate.humanReport) {
    throw new Error("outcome_certificate: humanReport must equal formatOutcomeCertificateHuman(certificate)");
  }
  const validateCert = loadSchemaValidator("outcome-certificate-v3");
  if (!validateCert(certificate)) {
    throw new Error(`outcome_certificate: schema validation failed ${JSON.stringify(validateCert.errors ?? [])}`);
  }
}
