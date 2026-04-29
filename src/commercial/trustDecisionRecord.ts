import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { firstProblemStepForCertificate, formatDecisionBlockerForHumans } from "../decisionBlocker.js";
import { trustDecisionFromCertificate, type TrustDecision } from "../trustDecision.js";

export type TrustGateKind = "contract_sql_irreversible" | "langgraph_checkpoint_terminal";

/** Wire + stored shape for trust decision ingestion (aligned with **`schemas/trust-decision-record-v1.schema.json`**). */
export type TrustDecisionRecordV1 = {
  schema_version: 1;
  trust_decision: TrustDecision;
  gate_kind: TrustGateKind;
  routing: { routing_key: string; team?: string; owner_slug?: string };
  certificate_snapshot: TrustCertificateSnapshotV1;
  human_blocker_lines: string[];
};

export type TrustCertificateSnapshotV1 = {
  schema_version: 1;
  workflow_id: string;
  run_kind: OutcomeCertificateV1["runKind"];
  state_relation: OutcomeCertificateV1["stateRelation"];
  high_stakes_reliance: OutcomeCertificateV1["highStakesReliance"];
  reason_codes: string[];
  first_problem:
    | {
        seq: number;
        tool_id: string;
        observed_trunc: string;
        expected_trunc: string;
      }
    | null;
};

/** Max UTF-8 size for serialized **`TrustDecisionRecordV1`** posted to hosted ingest. */
export const MAX_TRUST_DECISION_RECORD_UTF8 = 65536;

function truncateUtf16CodeUnits(s: string, max: number): string {
  const t = s.length <= max ? s : `${s.slice(0, max - 1)}…`;
  return t.length <= max ? t : t.slice(0, max);
}

function sortedUniqueReasonCodes(details: OutcomeCertificateV1["explanation"]["details"], cap: number): string[] {
  const raw = details.map((d) => d.code);
  const out: string[] = [];
  for (const c of [...new Set(raw)].sort((a, b) => a.localeCompare(b))) {
    const t = c.length > 256 ? c.slice(0, 255) + "…" : c;
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

export function buildCertificateSnapshotV1(cert: OutcomeCertificateV1): TrustCertificateSnapshotV1 {
  const codes = sortedUniqueReasonCodes(cert.explanation.details, 24);
  const primary = firstProblemStepForCertificate(cert);
  return {
    schema_version: 1,
    workflow_id: cert.workflowId,
    run_kind: cert.runKind,
    state_relation: cert.stateRelation,
    high_stakes_reliance: cert.highStakesReliance,
    reason_codes: codes,
    first_problem:
      primary === null
        ? null
        : {
            seq: primary.seq,
            tool_id: primary.toolId ?? "unknown",
            observed_trunc: truncateUtf16CodeUnits(primary.observedOutcome, 512),
            expected_trunc: truncateUtf16CodeUnits(primary.expectedOutcome, 512),
          },
  };
}

export type BuildTrustDecisionRecordRoutingOpts = {
  workflowIdFallback: string;
  ownerRoutingKey?: string;
  routingTeam?: string;
  ownerSlug?: string;
};

export function buildTrustDecisionRecordV1(params: {
  certificate: OutcomeCertificateV1;
  gateKind: TrustGateKind;
  routingOpts: BuildTrustDecisionRecordRoutingOpts;
}): TrustDecisionRecordV1 {
  const { certificate, gateKind } = params;
  const { lines } = formatDecisionBlockerForHumans(certificate);
  const routing_key = params.routingOpts.ownerRoutingKey ?? params.routingOpts.workflowIdFallback;
  const routing: TrustDecisionRecordV1["routing"] = { routing_key };
  if (params.routingOpts.routingTeam !== undefined && params.routingOpts.routingTeam.length > 0) {
    routing.team = params.routingOpts.routingTeam;
  }
  if (params.routingOpts.ownerSlug !== undefined && params.routingOpts.ownerSlug.length > 0) {
    routing.owner_slug = params.routingOpts.ownerSlug;
  }

  const record: TrustDecisionRecordV1 = {
    schema_version: 1,
    trust_decision: trustDecisionFromCertificate(certificate),
    gate_kind: gateKind,
    routing,
    certificate_snapshot: buildCertificateSnapshotV1(certificate),
    human_blocker_lines: lines,
  };

  const size = Buffer.byteLength(JSON.stringify(record), "utf8");
  if (size > MAX_TRUST_DECISION_RECORD_UTF8) {
    throw new Error(`buildTrustDecisionRecordV1: record exceeds MAX_TRUST_DECISION_RECORD_UTF8 (${size} > ${MAX_TRUST_DECISION_RECORD_UTF8})`);
  }
  return record;
}
