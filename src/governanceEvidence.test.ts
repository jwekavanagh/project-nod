import { describe, expect, it } from "vitest";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import { minimalEvidenceCompletenessFixture } from "./evidenceCompleteness.js";
import { formatFailureSpineHuman } from "./formatFailureSpineHuman.js";
import { remediationMessageForRecommendedAction } from "./remediationMessage.js";
import {
  canonicalCertificateSha256,
  materialTruthProjectionFromCertificate,
  materialTruthSha256,
} from "./governanceEvidence.js";

const fixtureFailureSpine = {
  schemaVersion: 1 as const,
  trustDecision: "safe" as const,
  summary: "summary",
  actionableFailure: {
    category: "unclassified" as const,
    severity: "low" as const,
    recommendedAction: "none" as const,
    automationSafe: true,
  },
  primaryCodes: ["OK"],
  rerunGuidance: remediationMessageForRecommendedAction("none"),
  source: "workflow" as const,
};

function fixture(overrides?: Partial<OutcomeCertificateV1>): OutcomeCertificateV1 {
  const ec = minimalEvidenceCompletenessFixture({ blockerCategory: "none" });
  const humanReportBody =
    "human body\n\n=== evidence_completeness ===\nstub\n=== end evidence_completeness ===\n\n" +
    formatFailureSpineHuman(fixtureFailureSpine);
  return {
    schemaVersion: 3,
    workflowId: "wf_test",
    runKind: "contract_sql",
    stateRelation: "matches_expectations",
    highStakesReliance: "permitted",
    relianceRationale: "rationale",
    intentSummary: "summary",
    evidenceCompleteness: ec,
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
    humanReport: humanReportBody,
    failureSpine: fixtureFailureSpine,
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
    const p = materialTruthProjectionFromCertificate(fixture());
    expect(p.reasonCodes).toEqual(["CODE_A", "CODE_B"]);
    expect(p.evidenceGapPrimary).toBe("none");
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
      evidenceCompleteness: minimalEvidenceCompletenessFixture({
        blockerCategory: "none",
        unverifiedClaims: ["other"],
      }),
    });
    expect(materialTruthSha256(a)).toBe(materialTruthSha256(b));
    expect(canonicalCertificateSha256(a)).not.toBe(canonicalCertificateSha256(b));
  });
});
