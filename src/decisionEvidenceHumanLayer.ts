import { formatDistributionFooter } from "./distributionFooter.js";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";

export type HumanLayerFileV1 =
  | { schemaVersion: 1; kind: "report"; text: string }
  | { schemaVersion: 1; kind: "suppressed"; reason: "no_human_report" };

/**
 * Canonical JSON for human-layer.json (A3).
 */
export function buildHumanLayerFileJson(
  certificate: OutcomeCertificateV1,
  noHumanReport: boolean,
): HumanLayerFileV1 {
  if (noHumanReport) {
    return { schemaVersion: 1, kind: "suppressed", reason: "no_human_report" };
  }
  return { schemaVersion: 1, kind: "report", text: certificate.humanReport };
}

/**
 * Batch/contract verify: stderr bytes used with `process.stderr.write`. Ends with newline after footer.
 */
export function formatContractVerifyStderrForStderrWrite(
  certificate: OutcomeCertificateV1,
  options?: { prefixBeforeHuman?: string },
): string {
  const prefix = options?.prefixBeforeHuman ?? "";
  return `${prefix}${certificate.humanReport}\n${formatDistributionFooter()}\n`;
}

/**
 * Batch/contract verify: single line passed to `console.error` / `stderrLine` (no trailing newline after footer block; Node adds one).
 */
export function formatContractVerifyStderrForStderrLine(
  certificate: OutcomeCertificateV1,
  options?: { prefixBeforeHuman?: string },
): string {
  const prefix = options?.prefixBeforeHuman ?? "";
  return `${prefix}${certificate.humanReport}\n${formatDistributionFooter()}`;
}
