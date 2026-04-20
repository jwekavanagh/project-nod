import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { ossClaimRateLimitCounters } from "@/db/schema";
import { extractClientIpKey, utcHourStart } from "@/lib/magicLinkSendGate";
import {
  assertCanonicalOriginResolvable,
  isPublicFunnelAnonRequestAllowed,
} from "@/lib/publicFunnelAnonRequestAllowed";
import { PUBLIC_FUNNEL_ANON_IP_CAP } from "@/lib/publicFunnelAnonRateLimits";
import { withSerializableRetry } from "@/lib/ossClaimRateLimits";

export const runtime = "nodejs";

const SCOPE = "public_funnel_anon_ip" as const;

type WebsiteDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class RateLimitedPublicFunnelAnonIp extends Error {}

async function reservePublicFunnelAnonIpSlot(
  tx: WebsiteDbTransaction,
  ipKey: string,
): Promise<{ ok: true } | { ok: false }> {
  const H = utcHourStart();

  const locked = await tx
    .select()
    .from(ossClaimRateLimitCounters)
    .where(
      and(
        eq(ossClaimRateLimitCounters.scope, SCOPE),
        eq(ossClaimRateLimitCounters.windowStart, H),
        eq(ossClaimRateLimitCounters.scopeKey, ipKey),
      ),
    )
    .for("update");

  if (locked.length === 0) {
    await tx.insert(ossClaimRateLimitCounters).values({
      scope: SCOPE,
      windowStart: H,
      scopeKey: ipKey,
      count: 1,
    });
    return { ok: true };
  }

  const c = locked[0]!.count;
  if (c >= PUBLIC_FUNNEL_ANON_IP_CAP) {
    return { ok: false };
  }

  await tx
    .update(ossClaimRateLimitCounters)
    .set({ count: sql`${ossClaimRateLimitCounters.count} + 1` })
    .where(
      and(
        eq(ossClaimRateLimitCounters.scope, SCOPE),
        eq(ossClaimRateLimitCounters.windowStart, H),
        eq(ossClaimRateLimitCounters.scopeKey, ipKey),
      ),
    );

  return { ok: true };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    assertCanonicalOriginResolvable();
  } catch {
    return new NextResponse(null, { status: 503 });
  }

  if (!isPublicFunnelAnonRequestAllowed(req)) {
    return NextResponse.json({ code: "FUNNEL_ORIGIN_FORBIDDEN" }, { status: 403 });
  }

  try {
    await withSerializableRetry(async () =>
      db.transaction(async (tx) => {
        const ipKey = extractClientIpKey(req);
        const reserved = await reservePublicFunnelAnonIpSlot(tx, ipKey);
        if (!reserved.ok) {
          throw new RateLimitedPublicFunnelAnonIp();
        }
        return true;
      }),
    );
  } catch (e) {
    if (e instanceof RateLimitedPublicFunnelAnonIp) {
      return NextResponse.json({ code: "rate_limited", scope: SCOPE }, { status: 429 });
    }
    console.error(e);
    return new NextResponse(null, { status: 503 });
  }

  const funnel_anon_id = randomUUID();
  return NextResponse.json({ schema_version: 1 as const, funnel_anon_id }, { status: 200 });
}
