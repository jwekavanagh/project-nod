import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { trustDecisionFromCertificate } from "../trustDecision.js";
import type { RegressionArtifactV1 } from "../regressionArtifact.js";

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
  failureHint?: { likelyCause: string; nextAction: string };
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
    if (input.failureHint) {
      lines.push(`NEXT_ACTION: ${input.failureHint.nextAction} Likely cause: ${input.failureHint.likelyCause}`);
    } else {
      lines.push("NEXT_ACTION: Fix the reported verification mismatch/incompleteness and rerun `agentskeptic loop`.");
    }
  }
  lines.push(`RUN_REF: ${input.runRef}`);
  return lines.join("\n");
}

export function renderLoopOperationalUnknown(input: {
  message: string;
  nextAction: string;
  runRef: string;
}): string {
  return [
    "VERDICT: UNKNOWN",
    `WHY: ${input.message}`,
    "LOCAL_REGRESSION_COMPARE: no_anchor",
    `NEXT_ACTION: ${input.nextAction}`,
    `RUN_REF: ${input.runRef}`,
  ].join("\n");
}
