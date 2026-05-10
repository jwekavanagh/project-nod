import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOutcomeCertificateFromWorkflowResult } from "./outcomeCertificate.js";
import { remediationMessageForRecommendedAction } from "./remediationMessage.js";
import { redactEvidenceString } from "./redactEvidenceString.js";
import type { WorkflowResult } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("remediation decision parity (certificate evidence ↔ spine)", () => {
  it("wf_multi_all_fail: nextActions[0].id matches actionableFailure.recommendedAction; rerunGuidance matches redacted remediation line", () => {
    const raw = readFileSync(join(root, "test/golden/wf_multi_all_fail.stdout.json"), "utf8");
    const result = JSON.parse(raw) as WorkflowResult;
    const cert = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    const spine = cert.failureSpine;
    const ec = cert.evidenceCompleteness;
    expect(ec.nextActions[0]?.id).toBe(spine.actionableFailure.recommendedAction);
    const msg = remediationMessageForRecommendedAction(spine.actionableFailure.recommendedAction);
    expect(spine.rerunGuidance).toBe(redactEvidenceString(msg, 500));
  });

  it("contract certificate includes evidenceCompleteness.witnessCoverage rollup (Slice 1 SSOT)", () => {
    const raw = readFileSync(join(root, "test/golden/wf_multi_all_fail.stdout.json"), "utf8");
    const result = JSON.parse(raw) as WorkflowResult;
    const cert = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    const wc = cert.evidenceCompleteness.witnessCoverage;
    expect(wc).toBeDefined();
    expect(wc?.schemaVersion).toBe(1);
    expect(Array.isArray(wc?.exercisedKinds)).toBe(true);
    expect(Array.isArray(wc?.fullySatisfiedKinds)).toBe(true);
    expect(Array.isArray(wc?.notFullySatisfiedKinds)).toBe(true);
    expect(
      ["meaningful_multi_witness", "sql_only_contract", "single_non_sql_contract", "thin_or_unknown", "coverage_incomplete_or_failed"] as const,
    ).toContain(wc?.supportLabel);
  });
});
