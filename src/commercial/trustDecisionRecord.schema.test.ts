import { describe, expect, it } from "vitest";
import { loadSchemaValidator } from "../schemaLoad.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { minimalEvidenceCompletenessFixture } from "../evidenceCompleteness.js";
import { formatFailureSpineHuman } from "../formatFailureSpineHuman.js";
import { remediationMessageForRecommendedAction } from "../remediationMessage.js";
import { buildTrustDecisionRecordV1 } from "./trustDecisionRecord.js";

const ecMinimal = minimalEvidenceCompletenessFixture({ blockerCategory: "state_mismatch" });
const fsMinimal = {
  schemaVersion: 1 as const,
  trustDecision: "unsafe" as const,
  summary: "h",
  actionableFailure: {
    category: "state_inconsistency" as const,
    severity: "high" as const,
    recommendedAction: "manual_review" as const,
    automationSafe: false,
  },
  primaryCodes: ["C"],
  rerunGuidance: remediationMessageForRecommendedAction("manual_review"),
  source: "workflow" as const,
};
const humanBase =
  "r\n\n=== evidence_completeness ===\nx\n=== end evidence_completeness ===\n\n" +
  formatFailureSpineHuman(fsMinimal);

const minimalCertNoSafe: OutcomeCertificateV1 = {
  schemaVersion: 3,
  workflowId: "wf_x",
  runKind: "contract_sql",
  stateRelation: "does_not_match",
  highStakesReliance: "prohibited",
  relianceRationale: "x",
  intentSummary: "x",
  explanation: { headline: "h", details: [{ code: "C", message: "m" }] },
  evidenceCompleteness: ecMinimal,
  steps: [
    {
      seq: 0,
      toolId: "t",
      declaredAction: "a",
      expectedOutcome: "e",
      observedOutcome: "o",
    },
  ],
  humanReport: humanBase,
  failureSpine: fsMinimal,
};

describe("trust decision record ingest shape", () => {
  it("validates TrustDecisionRecordV1 envelope", () => {
    const record = buildTrustDecisionRecordV1({
      certificate: minimalCertNoSafe,
      gateKind: "contract_sql_irreversible",
      routingOpts: { workflowIdFallback: "wf_x" },
    });
    const v = loadSchemaValidator("trust-decision-record-v1");
    expect(v(record)).toBe(true);
  });
});
