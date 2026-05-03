import type {
  OutcomeCertificateHighStakesReliance,
  OutcomeCertificateRunKind,
  OutcomeCertificateStateRelation,
  OutcomeCertificateV3,
} from "./outcomeCertificate.js";

/** Sole operator-facing trust enum for high-stakes gating. */
export type TrustDecision = "safe" | "unsafe" | "unknown";

export function trustDecisionFromRelianceFields(params: {
  runKind: OutcomeCertificateRunKind;
  stateRelation: OutcomeCertificateStateRelation;
  highStakesReliance: OutcomeCertificateHighStakesReliance;
}): TrustDecision {
  if (params.runKind === "quick_preview") return "unknown";
  if (params.highStakesReliance === "permitted") return "safe";
  if (params.stateRelation === "does_not_match") return "unsafe";
  return "unknown";
}

/**
 * Derive trust from Outcome Certificate v1 (normative: quick_preview is never high-stakes safe).
 */
export function trustDecisionFromCertificate(certificate: OutcomeCertificateV3): TrustDecision {
  return trustDecisionFromRelianceFields({
    runKind: certificate.runKind,
    stateRelation: certificate.stateRelation,
    highStakesReliance: certificate.highStakesReliance,
  });
}
