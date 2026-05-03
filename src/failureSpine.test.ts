import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { deriveRemediationDecisionFromWorkflowResult } from "./actionableFailure.js";
import { buildFailureSpineFromWorkflowResult } from "./failureSpine.js";
import type { WorkflowResult } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("buildFailureSpineFromWorkflowResult (wf_multi_all_fail golden)", () => {
  it("matches workflowTruthReport.failureAnalysis actionableFailure; unsafe; ROW_ABSENT primaryCodes", () => {
    const raw = readFileSync(join(root, "test/golden/wf_multi_all_fail.stdout.json"), "utf8");
    const result = JSON.parse(raw) as WorkflowResult;
    const fa = result.workflowTruthReport.failureAnalysis;
    expect(fa).not.toBeNull();

    const remediationDecision = deriveRemediationDecisionFromWorkflowResult(result);
    const spine = buildFailureSpineFromWorkflowResult({
      result,
      runKind: "contract_sql",
      stateRelation: "does_not_match",
      highStakesReliance: "prohibited",
      remediationDecision,
    });

    expect(spine.trustDecision).toBe("unsafe");
    expect(spine.source).toBe("workflow");
    expect(spine.summary).toBe(fa!.summary);
    expect(spine.actionableFailure).toEqual(fa!.actionableFailure);
    expect(spine.primaryCodes).toEqual(["ROW_ABSENT"]);
    expect(spine.schemaVersion).toBe(1);
  });
});
