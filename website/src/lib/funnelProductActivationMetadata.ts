import type { ProductActivationRequest } from "@/lib/funnelProductActivation.contract";

export function rowMetadataVerifyStarted(
  body: Extract<ProductActivationRequest, { event: "verify_started" }>,
) {
  return {
    schema_version: 1 as const,
    run_id: body.run_id,
    issued_at: body.issued_at,
    workload_class: body.workload_class,
    subcommand: body.subcommand,
    build_profile: body.build_profile,
  };
}

export function rowMetadataVerifyOutcome(
  body: Extract<ProductActivationRequest, { event: "verify_outcome" }>,
) {
  return {
    schema_version: 1 as const,
    run_id: body.run_id,
    issued_at: body.issued_at,
    workload_class: body.workload_class,
    subcommand: body.subcommand,
    build_profile: body.build_profile,
    terminal_status: body.terminal_status,
  };
}
