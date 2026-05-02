import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import { trustDecisionFromCertificate } from "./trustDecision.js";

function inferStepStatus(step: OutcomeCertificateV1["steps"][0]): string {
  const o = step.observedOutcome.toLowerCase();
  if (o.includes("missing") || o.includes("row is missing")) return "missing";
  // Batch contract `formatBatchObservedStateSummary`: ROW_ABSENT is often summarized as `rowCount=0` only.
  if (/\browcount=0\b/.test(o) && !o.includes("field=")) return "missing";
  if (o.includes("mismatch") || o.includes("wrong")) return "inconsistent";
  if (o.includes("matched") || o.includes("verified")) return "verified";
  return "non_verified";
}

/** Exported for Trust Decision Record / material truth snapshots. */
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
