import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
import {
  ACTIVATION_PROBLEM_BASE,
  activationProblem,
  activationRedirect,
} from "@/lib/activationHttp";
import { extractClientIpKey } from "@/lib/magicLinkSendGate";
import {
  claimHandoffErrorRedirect,
  claimHandoffSigninRedirect,
} from "@/lib/ossClaimHandoffUrl";
import { buildClearCookiePendingHeader } from "@/lib/ossClaimPendingCookie";
import { mintOssClaimPendingSetCookieHeader } from "@/lib/ossClaimPendingMint";
import { reserveClaimHandoffIpSlot, withSerializableRetry } from "@/lib/ossClaimRateLimits";

export class RateLimitedClaimHandoffIp extends Error {}

const MAX_HANDOFF_QUERY_LEN = 256;

function redirectWithClearCookie(req: NextRequest, url: string): NextResponse {
  const res = activationRedirect(req, url, 302);
  res.headers.append("Set-Cookie", buildClearCookiePendingHeader());
  return res;
}

function redirectWithSetCookie(req: NextRequest, url: string, setCookie: string): NextResponse {
  const res = activationRedirect(req, url, 302);
  res.headers.append("Set-Cookie", setCookie);
  return res;
}

/**
 * Shared GET handoff: mint pending cookie, set `handoff_consumed_at`, redirect to sign-in.
 * Used by `GET /verify/link` (steady state). Legacy `GET /api/oss/claim-handoff` only 308s here.
 */
export async function runOssClaimHandoffGet(req: NextRequest): Promise<NextResponse> {
  const hRaw = req.nextUrl.searchParams.get("h");
  const h = hRaw?.trim() ?? "";
  if (h.length === 0 || h.length > MAX_HANDOFF_QUERY_LEN) {
    return redirectWithClearCookie(req, claimHandoffErrorRedirect("handoff_invalid"));
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
            return redirectWithClearCookie(req, claimHandoffErrorRedirect("handoff_invalid"));
          }

          const row = rows[0]!;
          const now = new Date();
          if (row.expiresAt.getTime() < now.getTime() || row.claimedAt !== null) {
            return redirectWithClearCookie(req, claimHandoffErrorRedirect("handoff_invalid"));
          }

          if (row.handoffConsumedAt !== null) {
            return redirectWithClearCookie(req, claimHandoffErrorRedirect("handoff_used"));
          }

          const setCookie = mintOssClaimPendingSetCookieHeader({
            secretHash: row.secretHash,
            expiresAt: row.expiresAt,
            claimedAt: row.claimedAt,
          });
          if (!setCookie) {
            return redirectWithClearCookie(req, claimHandoffErrorRedirect("handoff_invalid"));
          }

          await tx
            .update(ossClaimTickets)
            .set({ handoffConsumedAt: now })
            .where(eq(ossClaimTickets.secretHash, row.secretHash));

          return redirectWithSetCookie(req, claimHandoffSigninRedirect(), setCookie);
        },
        { isolationLevel: "serializable" },
      ),
    );
  } catch (e) {
    if (e instanceof RateLimitedClaimHandoffIp) {
      return activationProblem(req, {
        status: 429,
        type: `${ACTIVATION_PROBLEM_BASE}/rate-limited`,
        title: "Too many requests",
        detail: "Claim handoff rate limit exceeded for this IP.",
        code: "RATE_LIMITED",
      });
    }
    console.error(e);
    return redirectWithClearCookie(req, claimHandoffErrorRedirect("handoff_invalid"));
  }
}
