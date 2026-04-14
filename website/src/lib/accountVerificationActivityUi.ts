import type { LicensedVerifyOutcomeMetadata } from "@/lib/funnelCommercialMetadata";

export const ACCOUNT_ACTIVITY_SCOPE_LINE =
  "Recent licensed CLI outcomes reported by your keys (not database row verdicts).";

const STATUS_LABEL: Record<LicensedVerifyOutcomeMetadata["terminal_status"], string> = {
  complete: "Reported: complete",
  inconsistent: "Reported: inconsistent",
  incomplete: "Reported: incomplete",
};

export function accountActivityStatusLabel(
  terminalStatus: LicensedVerifyOutcomeMetadata["terminal_status"],
): string {
  return STATUS_LABEL[terminalStatus];
}

export function accountActivityMetaLine(
  workloadClass: LicensedVerifyOutcomeMetadata["workload_class"],
  subcommand: LicensedVerifyOutcomeMetadata["subcommand"],
): string {
  return `Mode: ${workloadClass} · Command: ${subcommand}`;
}
