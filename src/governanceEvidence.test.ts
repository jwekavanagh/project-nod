import { describe, expect, it } from "vitest";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import { canonicalCertificateSha256, materialTruthProjectionV1, materialTruthSha256 } from "./governanceEvidence.js";

function fixture(overrides?: Partial<OutcomeCertificateV1>): OutcomeCertificateV1 {
  return {
    schemaVersion: 1,
    workflowId: "wf_test",
    runKind: "contract_sql",
    stateRelation: "matches_expectations",
    highStakesReliance: "permitted",
    relianceRationale: "rationale",
    intentSummary: "summary",
    explanation: {
      headline: "headline",
      details: [
        { code: "CODE_B", message: "msg b" },
        { code: "CODE_A", message: "msg a" },
      ],
    },
    steps: [
      {
        seq: 2,
        toolId: "tool_b",
        declaredAction: "action 2",
        expectedOutcome: "expected 2",
        observedOutcome: "observed 2",
      },
      {
        seq: 1,
        declaredAction: "action 1",
        expectedOutcome: "expected 1",
        observedOutcome: "observed 1",
      },
    ],
    humanReport: "human body",
    checkpointVerdicts: [
      {
        checkpointKey: "cp_b",
        verdict: "verified",
        seqs: [3, 2, 3],
        productionMeaning: "ignored in material truth",
      },
      {
        checkpointKey: "cp_a",
        verdict: "inconsistent",
        seqs: [1],
        productionMeaning: "ignored in material truth",
      },
    ],
    ...overrides,
  };
}

describe("governanceEvidence", () => {
  it("builds stable, normalized material truth projection", () => {
    const p = materialTruthProjectionV1(fixture());
    expect(p.reasonCodes).toEqual(["CODE_A", "CODE_B"]);
    expect(p.steps.map((s) => s.seq)).toEqual([1, 2]);
    expect(p.steps[0]?.toolId).toBe("");
    expect(p.checkpointVerdicts.map((c) => c.checkpointKey)).toEqual(["cp_a", "cp_b"]);
    expect(p.checkpointVerdicts[1]?.seqs).toEqual([2, 3]);
  });

  it("ignores narrative-only certificate changes for material hash", () => {
    const a = fixture();
    const b = fixture({
      humanReport: "changed human report",
      relianceRationale: "changed rationale",
      explanation: {
        headline: "changed headline",
        details: [
          { code: "CODE_B", message: "different message b" },
          { code: "CODE_A", message: "different message a" },
        ],
      },
    });
    expect(materialTruthSha256(a)).toBe(materialTruthSha256(b));
    expect(canonicalCertificateSha256(a)).not.toBe(canonicalCertificateSha256(b));
  });
});
