import { LICENSE_API_BASE_URL } from "../generated/commercialBuildFlags.js";
import type { TrustDecisionRecordV1 } from "./trustDecisionRecord.js";
import { postVerifyOutcomeBestEffort } from "../sdk/transport.js";

function resolveBearerApiKey(): string | null {
  return (
    process.env.AGENTSKEPTIC_API_KEY?.trim() || process.env.WORKFLOW_VERIFIER_API_KEY?.trim() || null
  );
}

/**
 * Emission allowed iff commercial origin (**`LICENSE_API_BASE_URL`**) and API key coexist.
 * Import rules forbid reading the metering-preflight env pair (`LICENSE_PREFLIGHT` + `_ENABLED`); see repo guard tests.
 */
export function commercialTrustDecisionIngestConfigured(): boolean {
  return LICENSE_API_BASE_URL.trim().length > 0 && resolveBearerApiKey() !== null;
}

/**
 * Best-effort POST to **`/api/v1/funnel/trust-decision-blocked`**. Never throws; never logs secrets.
 */
export async function postTrustDecisionBlocked(record: TrustDecisionRecordV1): Promise<void> {
  const base = LICENSE_API_BASE_URL.replace(/\/$/, "");
  if (base.length === 0) {
    return;
  }
  const apiKey = resolveBearerApiKey();
  if (!apiKey) {
    return;
  }

  const url = `${base}/api/v1/funnel/trust-decision-blocked`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  headers["x-request-id"] = crypto.randomUUID();

  await postVerifyOutcomeBestEffort({ url, body: record, headers, timeoutMs: 400 });
}
