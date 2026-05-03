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
});
