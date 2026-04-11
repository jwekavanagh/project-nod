import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { TruthLayerError } from "../truthLayerError.js";
import {
  LICENSE_API_BASE_URL,
  LICENSE_PREFLIGHT_ENABLED,
} from "../generated/commercialBuildFlags.js";

const RETRY_MS = [250, 750, 2250] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type LicensePreflightIntent = "verify" | "enforce";

type ReserveOk = { allowed: true; plan: string; limit: number; used: number };
type ReserveDeny = {
  allowed: false;
  code: string;
  message: string;
  upgrade_url?: string;
};

type ReserveBody = ReserveOk | ReserveDeny;

/**
 * Before contract-mode verification (commercial npm build), contact license API.
 * No-op when LICENSE_PREFLIGHT_ENABLED is false (OSS profile).
 */
export async function runLicensePreflightIfNeeded(
  intent: LicensePreflightIntent = "verify",
): Promise<void> {
  if (!LICENSE_PREFLIGHT_ENABLED) return;

  const apiKey = process.env.WORKFLOW_VERIFIER_API_KEY?.trim();
  if (!apiKey) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.LICENSE_KEY_MISSING,
      "Commercial workflow-verifier requires WORKFLOW_VERIFIER_API_KEY for contract verification. Sign in at the product website to obtain a key.",
    );
  }

  const runId =
    process.env.WORKFLOW_VERIFIER_RUN_ID?.trim() || crypto.randomUUID();
  const issuedAt = new Date().toISOString();
  const url = `${LICENSE_API_BASE_URL.replace(/\/$/, "")}/api/v1/usage/reserve`;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ run_id: runId, issued_at: issuedAt, intent }),
      });

      const text = await res.text();
      let body: ReserveBody | null = null;
      try {
        body = JSON.parse(text) as ReserveBody;
      } catch {
        body = null;
      }

      if (
        res.status === 429 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504
      ) {
        lastErr = new Error(`HTTP ${res.status}`);
        if (attempt < RETRY_MS.length) await sleep(RETRY_MS[attempt]!);
        continue;
      }

      if (!res.ok) {
        if (body && body.allowed === false) {
          if (body.code === "ENFORCEMENT_REQUIRES_PAID_PLAN") {
            const suffix = body.upgrade_url
              ? ` ${body.upgrade_url}`
              : "";
            throw new TruthLayerError(
              CLI_OPERATIONAL_CODES.ENFORCEMENT_REQUIRES_PAID_PLAN,
              `${body.message || "Enforcement requires a paid plan."}${suffix}`,
            );
          }
          if (body.code === "VERIFICATION_REQUIRES_SUBSCRIPTION") {
            const suffix = body.upgrade_url
              ? ` ${body.upgrade_url}`
              : "";
            throw new TruthLayerError(
              CLI_OPERATIONAL_CODES.VERIFICATION_REQUIRES_SUBSCRIPTION,
              `${body.message || "Licensed verification requires an active subscription."}${suffix}`,
            );
          }
          if (body.code === "SUBSCRIPTION_INACTIVE") {
            const suffix = body.upgrade_url ? ` ${body.upgrade_url}` : "";
            throw new TruthLayerError(
              CLI_OPERATIONAL_CODES.LICENSE_DENIED,
              `${body.message || "Subscription is not active for licensed verification or CI enforcement."}${suffix}`,
            );
          }
          throw new TruthLayerError(
            CLI_OPERATIONAL_CODES.LICENSE_DENIED,
            body.message || `License check failed (${body.code}).`,
          );
        }
        throw new TruthLayerError(
          CLI_OPERATIONAL_CODES.LICENSE_DENIED,
          `License check failed with HTTP ${res.status}.`,
        );
      }

      if (!body || body.allowed !== true) {
        throw new TruthLayerError(
          CLI_OPERATIONAL_CODES.LICENSE_DENIED,
          "License server returned an unexpected response.",
        );
      }
      return;
    } catch (e) {
      if (e instanceof TruthLayerError) throw e;
      lastErr = e;
      if (attempt < RETRY_MS.length) await sleep(RETRY_MS[attempt]!);
    }
  }

  const msg =
    lastErr instanceof Error ? lastErr.message : String(lastErr ?? "unknown");
  throw new TruthLayerError(
    CLI_OPERATIONAL_CODES.LICENSE_USAGE_UNAVAILABLE,
    `Could not reach license service after retries: ${msg}`,
  );
}
