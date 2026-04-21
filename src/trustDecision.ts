import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";

/** Sole operator-facing trust enum for high-stakes gating. */
export type TrustDecision = "safe" | "unsafe" | "unknown";

/**
 * Derive trust from Outcome Certificate v1 (normative: quick_preview is never high-stakes safe).
 */
export function trustDecisionFromCertificate(certificate: OutcomeCertificateV1): TrustDecision {
  if (certificate.runKind === "quick_preview") return "unknown";
  if (certificate.highStakesReliance === "permitted") return "safe";
  if (certificate.stateRelation === "does_not_match") return "unsafe";
  return "unknown";
}
