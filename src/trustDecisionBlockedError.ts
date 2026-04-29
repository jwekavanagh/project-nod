import type { TrustDecision } from "./trustDecision.js";
import type { TrustDecisionRecordV1 } from "./commercial/trustDecisionRecord.js";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";

/**
 * Raised when **`assertSafeForIrreversibleAction`** / LangGraph checkpoint production gate denies trust.
 * Carries deterministic **`record`** suitable for ingestion and UI (**`human_blocker_lines`** parallel **`message`** joined by newlines).
 */
export class TrustDecisionBlockedError extends Error {
  readonly record: TrustDecisionRecordV1;
  /** Mirrors **`record.trust_decision`** (non-**`safe`** when thrown). */
  readonly trustDecision: TrustDecision;
  /** Original certificate when available (**host-only consumers**). */
  readonly outcomeCertificate?: OutcomeCertificateV1;

  constructor(record: TrustDecisionRecordV1, outcomeCertificate?: OutcomeCertificateV1) {
    super(record.human_blocker_lines.join("\n"));
    this.name = "TrustDecisionBlockedError";
    this.record = record;
    this.trustDecision = record.trust_decision;
    if (outcomeCertificate !== undefined) {
      this.outcomeCertificate = outcomeCertificate;
    }
  }
}

