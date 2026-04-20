import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
import { PRODUCT_ACTIVATION_MAX_BODY_BYTES } from "@/lib/funnelProductActivationConstants";
import { extractClientIpKey } from "@/lib/magicLinkSendGate";
import {
  buildClearCookiePendingHeader,
  buildSetCookiePendingHeader,
  newOssClaimPendingRequestId,
  signPendingEnvelopeV1,
} from "@/lib/ossClaimPendingCookie";
import { hashOssClaimSecret } from "@/lib/ossClaimSecretHash";
import { ossClaimSecretSchema } from "@/lib/ossClaimTicketPayload";
import { reserveClaimPendingIpSlot, withSerializableRetry } from "@/lib/ossClaimRateLimits";

export const runtime = "nodejs";

class RateLimitedClaimPendingIp extends Error {}

function logPending(result: "stashed" | "noop", requestId: string): void {
  console.log(JSON.stringify({ kind: "oss_claim_pending", result, requestId }));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = newOssClaimPendingRequestId();
  const clearCookie = buildClearCookiePendingHeader();

  const rawCt = req.headers.get("content-type");
  const ct = rawCt?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    logPending("noop", requestId);
    return new NextResponse(null, { status: 400 });
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    logPending("noop", requestId);
    return new NextResponse(null, { status: 400 });
  }
  if (Buffer.byteLength(rawText, "utf8") > PRODUCT_ACTIVATION_MAX_BODY_BYTES) {
    logPending("noop", requestId);
    return new NextResponse(null, { status: 400 });
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawText) as unknown;
  } catch {
    logPending("noop", requestId);
    return new NextResponse(null, { status: 400 });
  }
  if (!jsonBody || typeof jsonBody !== "object" || Array.isArray(jsonBody)) {
    logPending("noop", requestId);
    return new NextResponse(null, { status: 400 });
  }

  const secretParsed = ossClaimSecretSchema.safeParse(
    (jsonBody as Record<string, unknown>).claim_secret,
  );
  if (!secretParsed.success) {
    logPending("noop", requestId);
    const res = new NextResponse(null, { status: 204 });
    res.headers.append("Set-Cookie", clearCookie);
    return res;
  }
  const claim_secret = secretParsed.data;

  try {
    const out = await withSerializableRetry(async () =>
      db.transaction(async (tx) => {
        const ipKey = extractClientIpKey(req);
        const reserved = await reserveClaimPendingIpSlot(tx, ipKey);
        if (!reserved.ok) {
          throw new RateLimitedClaimPendingIp();
        }

        const secretHash = hashOssClaimSecret(claim_secret);
        const rows = await tx.select().from(ossClaimTickets).where(eq(ossClaimTickets.secretHash, secretHash));

        const now = new Date();
        let setCookie: string | null = null;

        if (rows.length > 0) {
          const row = rows[0]!;
          const unclaimed = row.claimedAt === null;
          const notExpired = row.expiresAt.getTime() >= now.getTime();
          if (unclaimed && notExpired) {
            const signed = signPendingEnvelopeV1(secretHash, row.expiresAt);
            if (signed) {
              setCookie = buildSetCookiePendingHeader(signed.cookieValue, signed.maxAgeSec);
            }
          }
        }

        const stashed = setCookie !== null;
        return { setCookie, stashed, clearCookie };
      }),
    );

    logPending(out.stashed ? "stashed" : "noop", requestId);
    const res = new NextResponse(null, { status: 204 });
    if (out.setCookie) {
      res.headers.append("Set-Cookie", out.setCookie);
    } else {
      res.headers.append("Set-Cookie", out.clearCookie);
    }
    return res;
  } catch (e) {
    if (e instanceof RateLimitedClaimPendingIp) {
      logPending("noop", requestId);
      return NextResponse.json({ code: "rate_limited", scope: "claim_pending_ip" }, { status: 429 });
    }
    console.error(e);
    logPending("noop", requestId);
    return new NextResponse(null, { status: 503 });
  }
}
