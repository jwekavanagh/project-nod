import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import { minimalEvidenceCompletenessFixture } from "./evidenceCompleteness.js";
import {
  EVIDENCE_COMPLETENESS_BEGIN,
  formatEvidenceCompletenessHuman,
} from "./formatEvidenceCompletenessHuman.js";
import { writeDecisionEvidenceBundle } from "./decisionEvidenceBundle/writeDecisionEvidenceBundle.js";
import {
  formatValidationStdout,
  validateDecisionEvidenceBundle,
} from "./decisionEvidenceBundle/validateDecisionEvidenceBundle.js";

function minimalCertificate(stateRelation: OutcomeCertificateV1["stateRelation"]): OutcomeCertificateV1 {
  const ec = minimalEvidenceCompletenessFixture(
    stateRelation === "matches_expectations" ?
      { blockerCategory: "none" }
    : { blockerCategory: "state_mismatch" },
  );
  const rl = stateRelation === "matches_expectations" ? "permitted" : ("prohibited" as const);
  const hr = `${"human"}\n\n${formatEvidenceCompletenessHuman(ec, { runKind: "contract_sql", highStakesReliance: rl })}`;
  if (!hr.includes(EVIDENCE_COMPLETENESS_BEGIN)) throw new Error("fixture humanReport missing anchors");
  return {
    schemaVersion: 2,
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
