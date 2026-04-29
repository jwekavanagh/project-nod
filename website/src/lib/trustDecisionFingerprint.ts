import { createHash } from "node:crypto";
import type { TrustDecisionRecordIngest } from "./trustDecisionRecord.contract";

export function trustDecisionFingerprintHex(record: TrustDecisionRecordIngest): string {
  const snap = record.certificate_snapshot;
  const canonical = {
    workflow_id: snap.workflow_id,
    trust_decision: record.trust_decision,
    reason_codes: snap.reason_codes,
    state_relation: snap.state_relation,
    run_kind: snap.run_kind,
    gate_kind: record.gate_kind,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
