import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import type { TrustDecision } from "./trustDecision.js";
import { trustDecisionFromCertificate } from "./trustDecision.js";

export class DecisionUnsafeError extends Error {
  readonly trustDecision: TrustDecision;
  readonly certificate: OutcomeCertificateV1;

  constructor(certificate: OutcomeCertificateV1, lines: string[]) {
    super(lines.join("\n"));
    this.name = "DecisionUnsafeError";
    this.certificate = certificate;
    this.trustDecision = trustDecisionFromCertificate(certificate);
  }
}
