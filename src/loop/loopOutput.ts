import type { OperationalCode } from "../cliOperationalCodes.js";
import { deriveActionableFailureOperational } from "../actionableFailure.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { OPERATIONAL_DISPOSITION } from "../operationalDisposition.js";
import { remediationMessageForRecommendedAction } from "../remediationMessage.js";
import type { RegressionArtifactV1 } from "../regressionArtifact.js";
import { trustDecisionFromCertificate } from "../trustDecision.js";

function normalizedVerdict(certificate: OutcomeCertificateV1): "TRUSTED" | "NOT TRUSTED" | "UNKNOWN" {
  const trust = trustDecisionFromCertificate(certificate);
  if (trust === "safe") return "TRUSTED";
  if (trust === "unsafe") return "NOT TRUSTED";
  return "UNKNOWN";
}

export function renderLoopTerminalContract(input: {
  certificate: OutcomeCertificateV1;
  runRef: string;
  compare: { kind: "no_local_regression_anchor" } | { kind: "summary"; artifact: RegressionArtifactV1 };
}): string {
  const verdict = normalizedVerdict(input.certificate);
  const lines: string[] = [];
  lines.push(`VERDICT: ${verdict}`);
  lines.push(`WHY: ${input.certificate.explanation.headline}`);
  if (input.compare.kind === "no_local_regression_anchor") {
    lines.push("LOCAL_REGRESSION_COMPARE: no_anchor");
  } else {
    const v = input.compare.artifact.verification.compareHighlights;
    lines.push(
      `LOCAL_REGRESSION_COMPARE: classification=${input.compare.artifact.narrative.classification}; introduced=${v.introducedLogicalStepKeys.length}; resolved=${v.resolvedLogicalStepKeys.length}; recurring=${v.recurringSignatures.length}`,
    );
  }
  if (verdict !== "TRUSTED") {
    const nextPrimary =
      input.certificate.evidenceCompleteness.nextActions[0]?.text ??
      "Fix the reported verification mismatch/incompleteness and rerun `agentskeptic loop`.";
    lines.push(`NEXT_ACTION: ${nextPrimary}`);
  }
  lines.push(`RUN_REF: ${input.runRef}`);
  return lines.join("\n");
}

export function renderLoopOperationalUnknown(input: {
  /** TruthLayerError.code or best-effort operational code string */
  code: string;
  message: string;
  runRef: string;
}): string {
  const row = OPERATIONAL_DISPOSITION[input.code as OperationalCode];
  const why = row?.summary ?? input.message;
  const af = deriveActionableFailureOperational(input.code);
  const nextAction = remediationMessageForRecommendedAction(af.recommendedAction);
  return [
    "VERDICT: UNKNOWN",
    `WHY: ${why}`,
    "LOCAL_REGRESSION_COMPARE: no_anchor",
    `NEXT_ACTION: ${nextAction}`,
    `RUN_REF: ${input.runRef}`,
  ].join("\n");
}
