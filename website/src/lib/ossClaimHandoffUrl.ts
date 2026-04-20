import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";

export const OSS_CLAIM_HANDOFF_RESPONSE_SCHEMA_VERSION = 2 as const;

export type OssClaimTicketHandoffResponseBody = {
  schema_version: typeof OSS_CLAIM_HANDOFF_RESPONSE_SCHEMA_VERSION;
  handoff_url: string;
};

export function buildOssClaimHandoffUrl(origin: string, handoffToken: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/oss/claim-handoff?h=${encodeURIComponent(handoffToken)}`;
}

export function buildOssClaimHandoffUrlCanonical(handoffToken: string): string {
  return buildOssClaimHandoffUrl(getCanonicalSiteOrigin(), handoffToken);
}

export function claimHandoffErrorRedirect(error: "handoff_invalid" | "handoff_used"): string {
  const o = getCanonicalSiteOrigin().replace(/\/$/, "");
  return `${o}/claim?error=${error}`;
}

export function claimHandoffSigninRedirect(): string {
  const o = getCanonicalSiteOrigin().replace(/\/$/, "");
  return `${o}/auth/signin?callbackUrl=${encodeURIComponent("/claim")}`;
}
