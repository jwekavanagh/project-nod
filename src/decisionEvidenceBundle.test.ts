import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import { minimalEvidenceCompletenessFixture } from "./evidenceCompleteness.js";
import {
  EVIDENCE_COMPLETENESS_BEGIN,
  formatEvidenceCompletenessHuman,
} from "./formatEvidenceCompletenessHuman.js";
import { formatFailureSpineHuman } from "./formatFailureSpineHuman.js";
import type { FailureSpineV1 } from "./failureSpine.js";
import { remediationMessageForRecommendedAction } from "./remediationMessage.js";
import { writeDecisionEvidenceBundle } from "./decisionEvidenceBundle/writeDecisionEvidenceBundle.js";
import {
  formatValidationStdout,
  validateDecisionEvidenceBundle,
} from "./decisionEvidenceBundle/validateDecisionEvidenceBundle.js";

function minimalFailureSpine(stateRelation: OutcomeCertificateV1["stateRelation"]): FailureSpineV1 {
  if (stateRelation === "matches_expectations") {
    return {
      schemaVersion: 1,
      trustDecision: "safe",
      summary: "s",
      actionableFailure: {
        category: "unclassified",
        severity: "low",
        recommendedAction: "none",
        automationSafe: true,
      },
      primaryCodes: ["OK"],
      rerunGuidance: remediationMessageForRecommendedAction("none"),
      source: "workflow",
    };
  }
  return {
    schemaVersion: 1,
    trustDecision: "unsafe",
    summary: "h",
    actionableFailure: {
      category: "state_inconsistency",
      severity: "high",
      recommendedAction: "manual_review",
      automationSafe: false,
    },
    primaryCodes: ["ROW_ABSENT"],
    rerunGuidance: remediationMessageForRecommendedAction("manual_review"),
    source: "workflow",
  };
}

function minimalCertificate(stateRelation: OutcomeCertificateV1["stateRelation"]): OutcomeCertificateV1 {
  const ec = minimalEvidenceCompletenessFixture(
    stateRelation === "matches_expectations" ?
      { blockerCategory: "none" }
    : { blockerCategory: "state_mismatch" },
  );
  const rl = stateRelation === "matches_expectations" ? "permitted" : ("prohibited" as const);
  const fs = minimalFailureSpine(stateRelation);
  const hrBase = `${"human"}\n\n${formatEvidenceCompletenessHuman(ec, { runKind: "contract_sql", highStakesReliance: rl })}`;
  if (!hrBase.includes(EVIDENCE_COMPLETENESS_BEGIN)) throw new Error("fixture humanReport missing anchors");
  const hr = `${hrBase}\n\n${formatFailureSpineHuman(fs)}`;
  return {
    schemaVersion: 3,
    workflowId: "wf_test",
    runKind: "contract_sql",
    stateRelation,
    highStakesReliance: rl,
    relianceRationale: "r",
    intentSummary: "s",
    explanation: { headline: "h", details: [] },
    evidenceCompleteness: ec,
    steps: [],
    humanReport: hr,
    failureSpine: fs,
  };
}

describe("decisionEvidenceBundle", () => {
  it("validate fails partial when A5 required and missing", () => {
    const dir = path.join(process.cwd(), `tmp-de-bundle-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeDecisionEvidenceBundle({
        outDir: dir,
        certificate: minimalCertificate("does_not_match"),
        noHumanReport: false,
        runId: "run-1",
      });
      const line = validateDecisionEvidenceBundle(dir);
      expect(line.status).toBe("partial");
      expect(line.errors.some((e) => e.code === "A5_REQUIRED_MISSING")).toBe(true);
      expect(JSON.parse(formatValidationStdout(line)).schemaVersion).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("validate complete for matches_expectations without next-action", () => {
    const dir = path.join(process.cwd(), `tmp-de-bundle-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      writeDecisionEvidenceBundle({
        outDir: dir,
        certificate: minimalCertificate("matches_expectations"),
        noHumanReport: false,
        runId: "run-2",
      });
      const line = validateDecisionEvidenceBundle(dir);
      expect(line.status).toBe("complete");
      expect(line.errors).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
