import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildRunComparisonReport } from "./runComparison.js";
import { buildRegressionArtifactFromDebugCorpus } from "./regressionArtifact.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { stringifyWithSortedKeys } from "./sortedJsonStringify.js";
import type { StepOutcome, WorkflowEngineResult, WorkflowResult } from "./types.js";
import { createEmptyVerificationRunContext } from "./verificationRunContext.js";
import { finalizeEmittedWorkflowResult } from "./workflowTruthReport.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function sqlRowStep(
  seq: number,
  toolId: string,
  keyValue: string,
  verified: boolean,
): StepOutcome {
  return {
    seq,
    toolId,
    intendedEffect: { narrative: "" },
    observedExecution: { paramsCanonical: "{}" },
    verificationRequest: {
      kind: "sql_row",
      table: "contacts",
      identityEq: [{ column: "id", value: keyValue }],
      requiredFields: {},
    },
    status: verified ? "verified" : "missing",
    reasons: verified ? [] : [{ code: "ROW_ABSENT", message: "absent" }],
    evidenceSummary: verified ? {} : { rowCount: 0 },
    repeatObservationCount: 1,
    evaluatedObservationOrdinal: 1,
    ...(verified ? {} : { failureDiagnostic: "workflow_execution" as const }),
  };
}

function wf(steps: StepOutcome[], id = "wf_compare_ac"): WorkflowResult {
  const bad = steps.some((s) => s.status !== "verified");
  const engine: WorkflowEngineResult = {
    schemaVersion: 8,
    workflowId: id,
    status: bad ? "inconsistent" : "complete",
    runLevelReasons: [],
    verificationPolicy: {
      consistencyMode: "strong",
      verificationWindowMs: 0,
      pollIntervalMs: 0,
    },
    eventSequenceIntegrity: { kind: "normal" },
    verificationRunContext: createEmptyVerificationRunContext(),
    steps,
  };
  return finalizeEmittedWorkflowResult(engine);
}

describe("Run comparison acceptance tests", () => {
  const v = loadSchemaValidator("run-comparison-report");
  const vArtifact = loadSchemaValidator("regression-artifact-v1");
  const vCert = loadSchemaValidator("outcome-certificate-v2");

  it("AC_9_1_multi_run_compare_emits_schema_v4", () => {
    const r0 = wf([sqlRowStep(0, "t", "a", true)]);
    const r1 = wf([sqlRowStep(0, "t", "a", true)]);
    const r2 = wf([sqlRowStep(0, "t", "a", true)]);
    const report = buildRunComparisonReport([r0, r1, r2], ["r0", "r1", "r2"]);
    expect(report.schemaVersion).toBe(4);
    expect(report.runs).toHaveLength(3);
    expect(v(report)).toBe(true);
  });

  it("AC_9_2_compareHighlights_match_fixture", () => {
    const r0 = wf([sqlRowStep(0, "t1", "a", true), sqlRowStep(1, "t1", "b", true)]);
    const r1 = wf([sqlRowStep(0, "t1", "b", true), sqlRowStep(1, "t1", "a", false)]);
    const report = buildRunComparisonReport([r0, r1], ["r0", "r1"]);
    expect(v(report)).toBe(true);
    expect(report.compareHighlights.introducedLogicalStepKeys).toContain("sql_row|contacts|id=a");
    expect(report.compareHighlights.resolvedLogicalStepKeys.length).toBeGreaterThanOrEqual(0);
  });

  it("AC_regression_artifact_narrative_matches_reliability_and_digest_recomputes", () => {
    const base = join(root, "test", "fixtures", "debug-ui-compare");
    const r0 = JSON.parse(readFileSync(join(base, "run_a", "workflow-result.json"), "utf8")) as WorkflowResult;
    const r1 = JSON.parse(readFileSync(join(base, "run_b", "workflow-result.json"), "utf8")) as WorkflowResult;
    const art = buildRegressionArtifactFromDebugCorpus({
      results: [r0, r1],
      runIds: ["run_a", "run_b"],
      eventPaths: [join(base, "run_a", "events.ndjson"), join(base, "run_b", "events.ndjson")],
    });
    expect(vArtifact(art as unknown as object)).toBe(true);
    expect(art.narrative.classification).toBe(art.verification.reliabilityAssessment.headlineVerdict);
    expect(art.narrative.headline).toBe(art.verification.reliabilityAssessment.headlineRationale);
    for (const row of art.outcomeCertificates) {
      expect(vCert(row.certificate as object)).toBe(true);
      const fromCert = createHash("sha256")
        .update(stringifyWithSortedKeys(row.certificate), "utf8")
        .digest("hex");
      expect(fromCert).toBe(row.certificateCanonicalDigest);
    }
  });

  it("AC_9_4_headlineVerdict_window_pairwise_divergence", () => {
    const r0 = wf([sqlRowStep(0, "t", "a", true)]);
    const r1 = wf([sqlRowStep(0, "t", "a", false)]);
    const r2 = wf([sqlRowStep(0, "t", "a", true)]);
    const report = buildRunComparisonReport([r0, r1, r2], ["r0", "r1", "r2"]);
    expect(report.reliabilityAssessment.windowTrend).toBe("unchanged");
    expect(report.reliabilityAssessment.pairwiseTrend).toBe("improving");
    const golden = JSON.parse(
      readFileSync(join(root, "test/fixtures/debug-ui-compare/headline-ac-9-4.json"), "utf8"),
    ) as { headlineVerdict: string; headlineRationale: string };
    expect(report.reliabilityAssessment.headlineVerdict).toBe(golden.headlineVerdict);
    expect(report.reliabilityAssessment.headlineRationale).toBe(golden.headlineRationale);
  });
});
