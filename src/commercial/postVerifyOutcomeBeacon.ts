import {
  LICENSE_API_BASE_URL,
  LICENSE_PREFLIGHT_ENABLED,
} from "../generated/commercialBuildFlags.js";
import { fetchWithTimeout } from "../telemetry/fetchWithTimeout.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import {
  buildVerifyOutcomeBeaconBodyV2,
  type VerifyOutcomeSubcommand,
  type VerifyOutcomeTerminalStatus,
  type VerifyOutcomeWorkloadClass,
} from "./verifyOutcomeBeaconBody.js";

/**
 * Best-effort POST to license origin. Never throws; never logs secrets.
 */
export async function postVerifyOutcomeBeacon(input: {
  runId: string | null;
  certificate: OutcomeCertificateV1;
  terminal_status: VerifyOutcomeTerminalStatus;
  workload_class: VerifyOutcomeWorkloadClass;
  subcommand: VerifyOutcomeSubcommand;
}): Promise<void> {
  if (!LICENSE_PREFLIGHT_ENABLED || input.runId === null) return;

  const apiKey =
    process.env.AGENTSKEPTIC_API_KEY?.trim() ||
    process.env.WORKFLOW_VERIFIER_API_KEY?.trim();
  if (!apiKey) return;

  const url = `${LICENSE_API_BASE_URL.replace(/\/$/, "")}/api/v1/funnel/verify-outcome`;
  const body = buildVerifyOutcomeBeaconBodyV2({
    run_id: input.runId,
    certificate: input.certificate,
    terminal_status: input.terminal_status,
    workload_class: input.workload_class,
    subcommand: input.subcommand,
  });
  try {
    await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      400,
    );
  } catch {
    /* ignore */
  }
}
