import { AGENTSKEPTIC_CLI_SEMVER } from "../publicDistribution.generated.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "./productActivationHeaders.js";
import { resolveOssClaimApiOrigin } from "./ossClaimOrigin.js";
import { resolveTelemetrySource } from "./resolveTelemetrySource.js";

const OSS_CLAIM_TICKET_FETCH_TIMEOUT_MS = 400;

const RETRY_MS = [250, 750, 2250] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type PostOssClaimTicketInput = {
  claim_secret: string;
  run_id: string;
  issued_at: string;
  terminal_status: "complete" | "inconsistent" | "incomplete";
  workload_class: "bundled_examples" | "non_bundled";
  subcommand: "batch_verify" | "quick_verify" | "verify_integrator_owned";
  build_profile: "oss" | "commercial";
  /** Mint-time interactive human cohort (`D_ihm`); must match CLI TTY rule in journey SSOT. */
  interactive_human?: boolean;
  /** Echoed as `x-request-id` (match claim-continuation for the same ticket). */
  xRequestId?: string;
};

export type PostOssClaimTicketResult =
  | { outcome: "ok"; handoff_url: string }
  | { outcome: "already_claimed" }
  | { outcome: "rate_limited" }
  | { outcome: "forbidden" }
  | { outcome: "bad_request" }
  | { outcome: "failed" };

function readProblemCode(j: Record<string, unknown> | null): string | undefined {
  if (!j || typeof j.code !== "string") return undefined;
  return j.code;
}

async function postOssClaimTicketOnce(input: PostOssClaimTicketInput): Promise<PostOssClaimTicketResult> {
  if (process.env.AGENTSKEPTIC_TELEMETRY?.trim() === "0") return { outcome: "failed" };

  const base = resolveOssClaimApiOrigin();
  const url = `${base}/api/oss/claim-ticket`;
  const telemetry_source = resolveTelemetrySource();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER]: PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
    [PRODUCT_ACTIVATION_CLI_VERSION_HEADER]: AGENTSKEPTIC_CLI_SEMVER,
  };
  if (input.xRequestId?.trim()) {
    headers["x-request-id"] = input.xRequestId.trim();
  }
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          schema_version: 2 as const,
          telemetry_source,
          claim_secret: input.claim_secret,
          run_id: input.run_id,
          issued_at: input.issued_at,
          terminal_status: input.terminal_status,
          workload_class: input.workload_class,
          subcommand: input.subcommand,
          build_profile: input.build_profile,
          ...(input.interactive_human === true ? { interactive_human: true as const } : {}),
        }),
      },
      OSS_CLAIM_TICKET_FETCH_TIMEOUT_MS,
    );

    if (res.status === 200) {
      const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (
        j &&
        j.schema_version === 2 &&
        typeof j.handoff_url === "string" &&
        j.handoff_url.length > 0
      ) {
        return { outcome: "ok", handoff_url: j.handoff_url };
      }
      return { outcome: "failed" };
    }
    if (res.status === 204) {
      return { outcome: "already_claimed" };
    }
    if (res.status === 429) {
      return { outcome: "rate_limited" };
    }
    if (res.status === 403) {
      return { outcome: "forbidden" };
    }
    if (res.status === 400 || res.status === 413) {
      const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const c = readProblemCode(j);
      if (c === "RATE_LIMITED") return { outcome: "rate_limited" };
      if (c === "FORBIDDEN") return { outcome: "forbidden" };
      return { outcome: "bad_request" };
    }
    return { outcome: "failed" };
  } catch {
    return { outcome: "failed" };
  }
}

/**
 * POST /api/oss/claim-ticket to canonical origin with bounded retries (same `claim_secret` each attempt).
 */
export async function postOssClaimTicket(input: PostOssClaimTicketInput): Promise<PostOssClaimTicketResult> {
  for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
    const r = await postOssClaimTicketOnce(input);
    if (r.outcome === "ok" || r.outcome === "already_claimed") return r;
    if (r.outcome === "rate_limited" || r.outcome === "forbidden" || r.outcome === "bad_request") return r;
    if (attempt < RETRY_MS.length) {
      await sleep(RETRY_MS[attempt]!);
    }
  }
  return { outcome: "failed" };
}
