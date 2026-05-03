import { describe, expect, it } from "vitest";
import {
  formatQuickVerifyHumanReport,
  QUICK_VERIFY_BANNER_LINE_1,
  QUICK_VERIFY_BANNER_LINE_2,
  QUICK_VERIFY_BANNER_LINE_3,
} from "./formatQuickVerifyHumanReport.js";
import { HUMAN_REPORT_BEGIN, HUMAN_REPORT_END, verdictLine } from "./quickVerifyHumanCopy.js";
import { DEFAULT_QUICK_VERIFY_SCOPE } from "./quickVerifyScope.js";
import { buildQuickVerifyProductTruth } from "./quickVerifyProductTruth.js";
import { deriveRemediationDecisionFromQuickReport } from "../actionableFailure.js";
import { buildEvidenceCompletenessFromQuickReport } from "../evidenceCompleteness.js";
import type { QuickVerifyReport } from "./runQuickVerify.js";

function minimalReport(verdict: "pass" | "fail" | "uncertain"): QuickVerifyReport {
  const ingest = { reasonCodes: ["INGEST_NO_ACTIONS"], malformedLineCount: 0 };
  const units: QuickVerifyReport["units"] = [];
  const summary = `Inferred provisional check — rollup ${verdict} is not a production-safety or audit-final verdict. 0 unit(s).`;
  const stub = {
    schemaVersion: 5 as const,
    verdict,
    summary,
    verificationMode: "inferred" as const,
    scope: { ...DEFAULT_QUICK_VERIFY_SCOPE },
    productTruth: buildQuickVerifyProductTruth(false),
    ingest,
    units,
    exportableRegistry: { tools: [] },
    evidenceCompleteness: {
      schemaVersion: 1 as const,
      blockerCategory: "preview_lane" as const,
      quickSignal: "no_actions" as const,
      verifiedClaims: [],
      unverifiedClaims: [],
      missingInputs: [{ code: "_", hint: "_" }],
      nextActions: [{ id: "_", text: "_" }],
    },
  };
  const decision = deriveRemediationDecisionFromQuickReport(stub, "test");
  const evidenceCompleteness = buildEvidenceCompletenessFromQuickReport({ verdict, ingest, units }, decision);
  return {
    schemaVersion: 5,
    verdict,
    summary,
    verificationMode: "inferred",
    scope: { ...DEFAULT_QUICK_VERIFY_SCOPE },
    productTruth: buildQuickVerifyProductTruth(false),
    ingest,
    evidenceCompleteness,
    units,
    exportableRegistry: { tools: [] },
  };
}

describe("formatQuickVerifyHumanReport", () => {
  it("first three lines are exact anchors for uncertain", () => {
    const out = formatQuickVerifyHumanReport(minimalReport("uncertain"));
    const lines = out.split("\n");
    expect(lines[0]).toBe(HUMAN_REPORT_BEGIN);
    expect(lines[1]).toBe(verdictLine("uncertain"));
    expect(lines[2]).toBe(HUMAN_REPORT_END);
    expect(lines[3]).toBe(QUICK_VERIFY_BANNER_LINE_1);
    expect(lines[4]).toBe(QUICK_VERIFY_BANNER_LINE_2);
    expect(lines[5]).toBe(QUICK_VERIFY_BANNER_LINE_3);
    expect(lines.length).toBeGreaterThan(6);
  });

  it("first three lines are exact anchors for pass and fail", () => {
    for (const v of ["pass", "fail"] as const) {
      const out = formatQuickVerifyHumanReport(minimalReport(v));
      const lines = out.split("\n");
      expect(lines[0]).toBe(HUMAN_REPORT_BEGIN);
      expect(lines[1]).toBe(verdictLine(v));
      expect(lines[2]).toBe(HUMAN_REPORT_END);
    }
  });
});
