import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import {
  buildTrustDecisionRecordV1,
  type BuildTrustDecisionRecordRoutingOpts,
  type TrustGateKind,
} from "./commercial/trustDecisionRecord.js";
import { postTrustDecisionBlocked } from "./commercial/postTrustDecisionBlocked.js";
import { TrustDecisionBlockedError } from "./trustDecisionBlockedError.js";

/**
 * Mandatory emit (**best-effort**) then **`TrustDecisionBlockedError`**.
 * Caller must only invoke after determining trust is not **`safe`** from the outcome certificate.
 */
export async function finalizeIrreversibleBlockThrow(params: {
  certificate: OutcomeCertificateV1;
  gateKind: TrustGateKind;
  routingOpts: BuildTrustDecisionRecordRoutingOpts;
}): Promise<never> {
  const record = buildTrustDecisionRecordV1(params);
  await postTrustDecisionBlocked(record);
  throw new TrustDecisionBlockedError(record, params.certificate);
}
