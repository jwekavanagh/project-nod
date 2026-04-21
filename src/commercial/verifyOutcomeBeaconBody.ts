import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { trustDecisionFromCertificate } from "../trustDecision.js";

export type VerifyOutcomeTerminalStatus = "complete" | "inconsistent" | "incomplete";
export type VerifyOutcomeWorkloadClass = "bundled_examples" | "non_bundled";
export type VerifyOutcomeSubcommand = "batch_verify" | "quick_verify" | "verify_integrator_owned";

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

export function buildVerifyOutcomeBeaconBodyV2(input: {
  run_id: string;
  certificate: OutcomeCertificateV1;
  terminal_status: VerifyOutcomeTerminalStatus;
  workload_class: VerifyOutcomeWorkloadClass;
  subcommand: VerifyOutcomeSubcommand;
}): Record<string, unknown> {
  return {
    schema_version: 2,
    run_id: input.run_id,
    workflow_id: input.certificate.workflowId.slice(0, 512),
    trust_decision: trustDecisionFromCertificate(input.certificate),
    reason_codes: sortedReasonCodesFromCertificate(input.certificate, 8),
    terminal_status: input.terminal_status,
    workload_class: input.workload_class,
    subcommand: input.subcommand,
  };
}
