import { buildSetCookiePendingHeader, signPendingEnvelopeV1 } from "@/lib/ossClaimPendingCookie";

export type OssClaimTicketPendingMintRow = {
  secretHash: string;
  expiresAt: Date;
  claimedAt: Date | null;
};

/**
 * Build `Set-Cookie` for the pending OSS claim envelope when the ticket is unclaimed and unexpired.
 * Shared by `GET /api/oss/claim-handoff` (and any future server mint paths).
 */
export function mintOssClaimPendingSetCookieHeader(row: OssClaimTicketPendingMintRow): string | null {
  const now = new Date();
  const unclaimed = row.claimedAt === null;
  const notExpired = row.expiresAt.getTime() >= now.getTime();
  if (!unclaimed || !notExpired) return null;
  const signed = signPendingEnvelopeV1(row.secretHash, row.expiresAt);
  if (!signed) return null;
  return buildSetCookiePendingHeader(signed.cookieValue, signed.maxAgeSec);
}
