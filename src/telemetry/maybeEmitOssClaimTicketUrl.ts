import { randomBytes } from "node:crypto";
import { LICENSE_PREFLIGHT_ENABLED } from "../generated/commercialBuildFlags.js";
import { newActivationHttpCorrelationId } from "../commercial/activationCorrelation.js";
import { openHandoffUrlInOsBrowser } from "./openHandoffUrlInOsBrowser.js";
import { postOssClaimContinuation } from "./postOssClaimContinuation.js";
import { postOssClaimTicket } from "./postOssClaimTicket.js";

export async function maybeEmitOssClaimTicketUrlToStderr(input: {
  run_id: string;
  terminal_status: "complete" | "inconsistent" | "incomplete";
  workload_class: "bundled_examples" | "non_bundled";
  subcommand: "batch_verify" | "quick_verify" | "verify_integrator_owned";
  build_profile: "oss" | "commercial";
  /** When set, reused for claim-ticket + claim-continuation HTTP `x-request-id`. */
  xRequestId?: string;
}): Promise<void> {
  if (LICENSE_PREFLIGHT_ENABLED) return;
  if (process.env.AGENTSKEPTIC_OSS_CLAIM_STDERR?.trim() === "0") return;
  if (process.env.AGENTSKEPTIC_TELEMETRY?.trim() === "0") return;

  const claim_secret = randomBytes(32).toString("hex");
  const issued_at = new Date().toISOString();
  const interactiveHuman =
    Boolean(process.stdout.isTTY) &&
    Boolean(process.stderr.isTTY) &&
    String(process.env.CI).toLowerCase() !== "true";

  const xRequestId = input.xRequestId?.trim() || newActivationHttpCorrelationId();

  const r = await postOssClaimTicket({
    claim_secret,
    issued_at,
    ...input,
    interactive_human: interactiveHuman ? true : undefined,
    xRequestId,
  });
  if (r.outcome === "ok") {
    if (interactiveHuman) {
      const { ok } = await openHandoffUrlInOsBrowser(r.handoff_url);
      if (ok) {
        await postOssClaimContinuation(claim_secret, xRequestId);
      }
    }
    console.error(
      `[agentskeptic] Link this verification run to your account: ${r.handoff_url} — open the link, then sign in with email when prompted.`,
    );
    return;
  }
  if (r.outcome === "already_claimed") {
    console.error(
      "[agentskeptic] This verification run was already linked to an account. Open the product site and sign in to manage your account, or run verify again for a new run.",
    );
    return;
  }
  if (r.outcome === "rate_limited") {
    console.error(
      `[agentskeptic] Could not register a claim link (rate limited). x-request-id=${xRequestId}`,
    );
    return;
  }
  if (r.outcome === "forbidden" || r.outcome === "bad_request") {
    console.error(
      `[agentskeptic] Could not register a claim link (${r.outcome}). x-request-id=${xRequestId}`,
    );
    return;
  }
  console.error(
    `[agentskeptic] Could not register a claim link (network). x-request-id=${xRequestId} When you are online, run verify again to get a new link, or sign in at the product site without this shortcut.`,
  );
}
