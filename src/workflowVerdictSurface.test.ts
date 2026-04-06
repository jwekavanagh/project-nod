import { describe, expect, it } from "vitest";
import { aggregateWorkflow } from "./aggregate.js";
import {
  buildWorkflowTruthReport,
  buildWorkflowVerdictSurface,
  finalizeEmittedWorkflowResult,
} from "./workflowTruthReport.js";
import type { Reason, StepOutcome, VerificationPolicy } from "./types.js";

const policy: VerificationPolicy = {
  consistencyMode: "strong",
  verificationWindowMs: 0,
  pollIntervalMs: 0,
};

function step(partial: Partial<StepOutcome> & Pick<StepOutcome, "seq" | "toolId" | "status">): StepOutcome {
  return {
    intendedEffect: { narrative: "" },
    observedExecution: { paramsCanonical: "{}" },
    verificationRequest: null,
    reasons: [],
    evidenceSummary: {},
    repeatObservationCount: 1,
    evaluatedObservationOrdinal: 1,
    ...partial,
  };
}

describe("buildWorkflowVerdictSurface", () => {
  it("matches truth report trustSummary and counts verified-only workflow", () => {
    const steps = [
      step({ seq: 0, toolId: "t", status: "verified" }),
    ];
    const engine = aggregateWorkflow("w1", steps, [], policy, { kind: "normal" });
    const wf = finalizeEmittedWorkflowResult(engine);
    const truth = buildWorkflowTruthReport(engine);
    const surface = buildWorkflowVerdictSurface(wf);
    expect(surface.status).toBe("complete");
    expect(surface.trustSummary).toBe(truth.trustSummary);
    expect(surface.stepStatusCounts.verified).toBe(1);
    expect(surface.stepStatusCounts.missing).toBe(0);
    expect(surface.stepStatusCounts.inconsistent).toBe(0);
    expect(surface.stepStatusCounts.incomplete_verification).toBe(0);
    expect(surface.stepStatusCounts.partially_verified).toBe(0);
    expect(surface.stepStatusCounts.uncertain).toBe(0);
  });

  it("counts inconsistent step and matches trustSummary for engine with missing row", () => {
    const steps = [
      step({
        seq: 0,
        toolId: "t",
        status: "missing",
        reasons: [{ code: "ROW_ABSENT", message: "x" }],
      }),
    ];
    const engine = aggregateWorkflow("w1", steps, [], policy, { kind: "normal" });
    const wf = finalizeEmittedWorkflowResult(engine);
    const truth = buildWorkflowTruthReport(engine);
    const surface = buildWorkflowVerdictSurface(wf);
    expect(surface.status).toBe("inconsistent");
    expect(surface.trustSummary).toBe(truth.trustSummary);
    expect(surface.stepStatusCounts.missing).toBe(1);
    expect(
      Object.values(surface.stepStatusCounts).reduce((a, b) => a + b, 0),
    ).toBe(1);
  });

  it("incomplete when run-level reasons present", () => {
    const steps = [step({ seq: 0, toolId: "t", status: "verified" })];
    const runLevel: Reason[] = [{ code: "MALFORMED_EVENT_LINE", message: "bad" }];
    const engine = aggregateWorkflow("w1", steps, runLevel, policy, { kind: "normal" });
    const wf = finalizeEmittedWorkflowResult(engine);
    const truth = buildWorkflowTruthReport(engine);
    const surface = buildWorkflowVerdictSurface(wf);
    expect(surface.status).toBe("incomplete");
    expect(surface.trustSummary).toBe(truth.trustSummary);
  });
});
