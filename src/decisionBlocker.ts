import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import { trustDecisionFromCertificate, type TrustDecision } from "./trustDecision.js";

function truncateOneLine(s: string, max: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function sortedUniqueCodes(codes: string[], cap: number): string[] {
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b)).slice(0, cap);
}

function inferStepStatus(step: OutcomeCertificateV1["steps"][0]): string {
  const o = step.observedOutcome.toLowerCase();
  if (o.includes("missing") || o.includes("row is missing")) return "missing";
  // Batch contract `formatBatchObservedStateSummary`: ROW_ABSENT is often summarized as `rowCount=0` only.
  if (/\browcount=0\b/.test(o) && !o.includes("field=")) return "missing";
  if (o.includes("mismatch") || o.includes("wrong")) return "inconsistent";
  if (o.includes("matched") || o.includes("verified")) return "verified";
  return "non_verified";
}

/**
 * Exported for Trust Decision Record snapshots — same selection rules as **`formatDecisionBlockerForHumans`**.
 */
export function firstProblemStepForCertificate(certificate: OutcomeCertificateV1): OutcomeCertificateV1["steps"][0] | null {
  const steps = [...certificate.steps].sort((a, b) => a.seq - b.seq);
  if (steps.length === 0) return null;
  const td = trustDecisionFromCertificate(certificate);
  if (td === "safe") return steps[0] ?? null;
  for (const s of steps) {
    if (inferStepStatus(s) !== "verified") return s;
  }
  return steps[0] ?? null;
}

/**
 * Fixed six-line human blocker for operators (Requirement 4 contract).
 */
export function formatDecisionBlockerForHumans(certificate: OutcomeCertificateV1): {
  trustDecision: TrustDecision;
  lines: string[];
} {
  const trustDecision = trustDecisionFromCertificate(certificate);
  const codes = sortedUniqueCodes(
    certificate.explanation.details.map((d) => d.code),
    5,
  );
  const primary = firstProblemStepForCertificate(certificate);

  const line3 =
    trustDecision === "safe"
      ? "First problem step: n/a"
      : primary !== null
        ? `First problem step: seq=${primary.seq} tool=${primary.toolId ?? "unknown"} status=${inferStepStatus(primary)}`
        : "First problem step: n/a";

  const line5 =
    primary !== null
      ? `Expected: ${truncateOneLine(primary.expectedOutcome, 200)}`
      : "Expected: (no step data)";
  const line6 =
    primary !== null
      ? `Observed: ${truncateOneLine(primary.observedOutcome, 200)}`
      : "Observed: (no step data)";

  const lines = [
    `Trust: ${trustDecision}`,
    `Workflow: ${certificate.workflowId}`,
    line3,
    `Reason codes: ${codes.length > 0 ? codes.join(", ") : "(none)"}`,
    line5,
    line6,
  ];
  if (lines.length !== 6) {
    throw new Error("formatDecisionBlockerForHumans: invariant violated (must be exactly 6 lines)");
  }
  return { trustDecision, lines };
}
