import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
import { extractClientIpKey } from "@/lib/magicLinkSendGate";
import {
  claimHandoffErrorRedirect,
  claimHandoffSigninRedirect,
} from "@/lib/ossClaimHandoffUrl";
import { buildClearCookiePendingHeader } from "@/lib/ossClaimPendingCookie";
import { mintOssClaimPendingSetCookieHeader } from "@/lib/ossClaimPendingMint";
import { reserveClaimHandoffIpSlot, withSerializableRetry } from "@/lib/ossClaimRateLimits";

export const runtime = "nodejs";

class RateLimitedClaimHandoffIp extends Error {}

const MAX_HANDOFF_QUERY_LEN = 256;

function redirectWithClearCookie(url: string): NextResponse {
  const res = NextResponse.redirect(url, 302);
  res.headers.append("Set-Cookie", buildClearCookiePendingHeader());
  return res;
}

function redirectWithSetCookie(url: string, setCookie: string): NextResponse {
  const res = NextResponse.redirect(url, 302);
  res.headers.append("Set-Cookie", setCookie);
  return res;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const hRaw = req.nextUrl.searchParams.get("h");
  const h = hRaw?.trim() ?? "";
  if (h.length === 0 || h.length > MAX_HANDOFF_QUERY_LEN) {
    return redirectWithClearCookie(claimHandoffErrorRedirect("handoff_invalid"));
  }

  try {
    return await withSerializableRetry(async () =>
      db.transaction(
        async (tx) => {
          const ipKey = extractClientIpKey(req);
          const reserved = await reserveClaimHandoffIpSlot(tx, ipKey);
          if (!reserved.ok) {
            throw new RateLimitedClaimHandoffIp();
          }

          const rows = await tx
            .select()
            .from(ossClaimTickets)
            .where(eq(ossClaimTickets.handoffToken, h))
            .for("update");

          if (rows.length === 0) {
            return redirectWithClearCookie(claimHandoffErrorRedirect("handoff_invalid"));
          }

          const row = rows[0]!;
          const now = new Date();
          if (row.expiresAt.getTime() < now.getTime() || row.claimedAt !== null) {
            return redirectWithClearCookie(claimHandoffErrorRedirect("handoff_invalid"));
          }

          if (row.handoffConsumedAt !== null) {
            return redirectWithClearCookie(claimHandoffErrorRedirect("handoff_used"));
          }

          const setCookie = mintOssClaimPendingSetCookieHeader({
            secretHash: row.secretHash,
            expiresAt: row.expiresAt,
            claimedAt: row.claimedAt,
          });
          if (!setCookie) {
            return redirectWithClearCookie(claimHandoffErrorRedirect("handoff_invalid"));
          }

          await tx
            .update(ossClaimTickets)
            .set({ handoffConsumedAt: now })
            .where(eq(ossClaimTickets.secretHash, row.secretHash));

          return redirectWithSetCookie(claimHandoffSigninRedirect(), setCookie);
        },
        { isolationLevel: "serializable" },
      ),
    );
  } catch (e) {
    if (e instanceof RateLimitedClaimHandoffIp) {
      return NextResponse.json({ code: "rate_limited", scope: "claim_handoff_ip" }, { status: 429 });
    }
    console.error(e);
    return redirectWithClearCookie(claimHandoffErrorRedirect("handoff_invalid"));
  }
}
