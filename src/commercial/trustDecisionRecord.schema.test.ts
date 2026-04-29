import { describe, expect, it } from "vitest";
import { loadSchemaValidator } from "../schemaLoad.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { buildTrustDecisionRecordV1 } from "./trustDecisionRecord.js";

const minimalCertNoSafe: OutcomeCertificateV1 = {
  schemaVersion: 1,
  workflowId: "wf_x",
  runKind: "contract_sql",
  stateRelation: "does_not_match",
  highStakesReliance: "prohibited",
  relianceRationale: "x",
  intentSummary: "x",
  explanation: { headline: "h", details: [{ code: "C", message: "m" }] },
  steps: [
    {
      seq: 0,
      toolId: "t",
      declaredAction: "a",
      expectedOutcome: "e",
      observedOutcome: "o",
    },
  ],
  humanReport: "r",
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
