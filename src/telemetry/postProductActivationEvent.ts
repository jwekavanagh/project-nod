import {
  LICENSE_API_BASE_URL,
  LICENSE_PREFLIGHT_ENABLED,
} from "../generated/commercialBuildFlags.js";
import {
  AGENTSKEPTIC_CLI_SEMVER,
  PUBLIC_CANONICAL_SITE_ORIGIN,
} from "../publicDistribution.generated.js";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "./productActivationHeaders.js";

const TELEMETRY_FETCH_TIMEOUT_MS = 400;

function resolveTelemetryBaseUrl(): string {
  const override = process.env.AGENTSKEPTIC_TELEMETRY_ORIGIN?.trim();
  if (override) return override.replace(/\/$/, "");
  if (LICENSE_PREFLIGHT_ENABLED && LICENSE_API_BASE_URL.trim()) {
    return LICENSE_API_BASE_URL.replace(/\/$/, "");
  }
  return PUBLIC_CANONICAL_SITE_ORIGIN.replace(/\/$/, "");
}

export type ProductActivationBuildProfile = "oss" | "commercial";

export type PostProductActivationStartedInput = {
  phase: "verify_started";
  run_id: string;
  issued_at: string;
  workload_class: "bundled_examples" | "non_bundled";
  subcommand: "batch_verify" | "quick_verify";
  build_profile: ProductActivationBuildProfile;
};

export type PostProductActivationOutcomeInput = {
  phase: "verify_outcome";
  run_id: string;
  issued_at: string;
  workload_class: "bundled_examples" | "non_bundled";
  subcommand: "batch_verify" | "quick_verify";
  build_profile: ProductActivationBuildProfile;
  terminal_status: "complete" | "inconsistent" | "incomplete";
};

export type PostProductActivationEventInput =
  | PostProductActivationStartedInput
  | PostProductActivationOutcomeInput;

/**
 * Best-effort POST to product-activation funnel. Never throws.
 * Disabled when AGENTSKEPTIC_TELEMETRY=0.
 */
export async function postProductActivationEvent(input: PostProductActivationEventInput): Promise<void> {
  if (process.env.AGENTSKEPTIC_TELEMETRY?.trim() === "0") return;

  const base = resolveTelemetryBaseUrl();
  const url = `${base}/api/funnel/product-activation`;
  const body =
    input.phase === "verify_started"
      ? {
          event: "verify_started" as const,
          schema_version: 1 as const,
          run_id: input.run_id,
          issued_at: input.issued_at,
          workload_class: input.workload_class,
          subcommand: input.subcommand,
          build_profile: input.build_profile,
        }
      : {
          event: "verify_outcome" as const,
          schema_version: 1 as const,
          run_id: input.run_id,
          issued_at: input.issued_at,
          workload_class: input.workload_class,
          subcommand: input.subcommand,
          build_profile: input.build_profile,
          terminal_status: input.terminal_status,
        };

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER]: PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
        [PRODUCT_ACTIVATION_CLI_VERSION_HEADER]: AGENTSKEPTIC_CLI_SEMVER,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TELEMETRY_FETCH_TIMEOUT_MS),
    });
  } catch {
    /* ignore */
  }
}
