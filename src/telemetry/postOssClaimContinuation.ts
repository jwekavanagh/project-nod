import { AGENTSKEPTIC_CLI_SEMVER } from "../publicDistribution.generated.js";
import { fetchWithTimeout } from "./fetchWithTimeout.js";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "./productActivationHeaders.js";
import { resolveOssClaimApiOrigin } from "./ossClaimOrigin.js";

const OSS_CLAIM_CONTINUATION_FETCH_TIMEOUT_MS = 400;

/**
 * POST /api/oss/claim-continuation — records `browser_open_invoked_at` once (interactive-human tickets only).
 */
export async function postOssClaimContinuation(
  claimSecret: string,
  xRequestId?: string,
): Promise<boolean> {
  if (process.env.AGENTSKEPTIC_TELEMETRY?.trim() === "0") return false;

  const base = resolveOssClaimApiOrigin();
  const url = `${base}/api/oss/claim-continuation`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER]: PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
    [PRODUCT_ACTIVATION_CLI_VERSION_HEADER]: AGENTSKEPTIC_CLI_SEMVER,
  };
  if (xRequestId?.trim()) {
    headers["x-request-id"] = xRequestId.trim();
  }
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ claim_secret: claimSecret }),
      },
      OSS_CLAIM_CONTINUATION_FETCH_TIMEOUT_MS,
    );
    return res.status === 204;
  } catch {
    return false;
  }
}
