import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { trustDecisionFromCertificate } from "../trustDecision.js";

export type VerifyOutcomeTerminalStatus = "complete" | "inconsistent" | "incomplete";
export type VerifyOutcomeWorkloadClass = "bundled_examples" | "non_bundled";
export type VerifyOutcomeSubcommand = "batch_verify" | "quick_verify" | "verify_integrator_owned" | "activate";

export type VerifyOutcomeActivationStageWire = {
  id: "ingest_input" | "provisional_infer" | "contract_verify" | "proof_export";
  status: "complete" | "failed" | "skipped";
  trust_label:
    | "n_a"
    | "provisional_pass"
    | "decision_ready"
    | "contract_inconsistent"
    | "contract_incomplete";
};

export type VerifyOutcomeActivationWire = {
  trust_terminal: "decision_ready" | "contract_inconsistent" | "contract_incomplete";
  stages: [VerifyOutcomeActivationStageWire, VerifyOutcomeActivationStageWire, VerifyOutcomeActivationStageWire, VerifyOutcomeActivationStageWire];
};

type BeaconBuildBase = {
  run_id: string;
  certificate: OutcomeCertificateV1;
  terminal_status: VerifyOutcomeTerminalStatus;
  workload_class: VerifyOutcomeWorkloadClass;
};

export type BuildVerifyOutcomeBeaconBodyV2Input =
  | (BeaconBuildBase & { subcommand: Exclude<VerifyOutcomeSubcommand, "activate"> })
  | (BeaconBuildBase & { subcommand: "activate"; activation: VerifyOutcomeActivationWire });

function sortedReasonCodesFromCertificate(certificate: OutcomeCertificateV1, max: number): string[] {
  const raw = certificate.explanation.details.map((d) => d.code);
  const out: string[] = [];
  for (const c of [...new Set(raw)].sort((a, b) => a.localeCompare(b))) {
    const t = c.length > 64 ? c.slice(0, 64) : c;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export function buildVerifyOutcomeBeaconBodyV2(input: BuildVerifyOutcomeBeaconBodyV2Input): Record<string, unknown> {
  const baseRecord: Record<string, unknown> = {
    schema_version: 3,
    run_id: input.run_id,
    workflow_id: input.certificate.workflowId.slice(0, 512),
    outcome_certificate_run_kind: input.certificate.runKind,
    evidence_gap_primary: input.certificate.evidenceCompleteness.blockerCategory,
    trust_decision: trustDecisionFromCertificate(input.certificate),
    reason_codes: sortedReasonCodesFromCertificate(input.certificate, 8),
    terminal_status: input.terminal_status,
    workload_class: input.workload_class,
    subcommand: input.subcommand,
  };
  if (input.subcommand === "activate") {
    baseRecord.activation = input.activation;
  }
  return baseRecord;
}
