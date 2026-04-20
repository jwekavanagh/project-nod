import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
import { logFunnelEvent } from "@/lib/funnelEvent";
import {
  buildClearCookiePendingHeader,
  OSS_PENDING_CLAIM_COOKIE_NAME,
  verifyPendingEnvelopeV1,
} from "@/lib/ossClaimPendingCookie";
import { hashOssClaimSecret } from "@/lib/ossClaimSecretHash";
import { ossClaimRedeemRequestSchema } from "@/lib/ossClaimTicketPayload";
import { reserveClaimRedeemUserSlot, withSerializableRetry } from "@/lib/ossClaimRateLimits";

export const runtime = "nodejs";

class RateLimitedClaimRedeemUser extends Error {}

function redeemJson(row: {
  runId: string;
  terminalStatus: string;
  workloadClass: string;
  subcommand: string;
  buildProfile: string;
  claimedAt: Date;
}) {
  return {
    schema_version: 1 as const,
    run_id: row.runId,
    terminal_status: row.terminalStatus,
    workload_class: row.workloadClass,
    subcommand: row.subcommand,
    build_profile: row.buildProfile,
    claimed_at: row.claimedAt.toISOString(),
  };
}

function withClearPendingCookie(res: NextResponse): NextResponse {
  res.headers.append("Set-Cookie", buildClearCookiePendingHeader());
  return res;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse(null, { status: 401 });
  }

  const rawCt = req.headers.get("content-type");
  const ct = rawCt?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    return withClearPendingCookie(NextResponse.json({ code: "claim_failed" }, { status: 400 }));
  }

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return withClearPendingCookie(NextResponse.json({ code: "claim_failed" }, { status: 400 }));
  }

  const parsed = ossClaimRedeemRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return withClearPendingCookie(NextResponse.json({ code: "claim_failed" }, { status: 400 }));
  }

  const rawPending = req.cookies.get(OSS_PENDING_CLAIM_COOKIE_NAME)?.value ?? null;
  let secretHash: string | null = null;
  if (rawPending) {
    const env = verifyPendingEnvelopeV1(rawPending);
    if (env) {
      secretHash = env.h;
    }
  }
  if (!secretHash) {
    if (!parsed.data.claim_secret) {
      return withClearPendingCookie(NextResponse.json({ code: "claim_failed" }, { status: 400 }));
    }
    secretHash = hashOssClaimSecret(parsed.data.claim_secret);
  }

  const userId = session.user.id;

  try {
    return await withSerializableRetry(async () =>
      db.transaction(
        async (tx) => {
          const rows = await tx
            .select()
            .from(ossClaimTickets)
            .where(eq(ossClaimTickets.secretHash, secretHash!))
            .for("update");

          if (rows.length === 0) {
            return withClearPendingCookie(NextResponse.json({ code: "claim_failed" }, { status: 400 }));
          }

          const row = rows[0]!;
          const now = new Date();
          if (row.expiresAt.getTime() < now.getTime()) {
            return withClearPendingCookie(NextResponse.json({ code: "claim_failed" }, { status: 400 }));
          }

          if (row.userId !== null && row.userId !== userId) {
            return withClearPendingCookie(NextResponse.json({ code: "already_claimed" }, { status: 409 }));
          }

          if (row.userId === userId && row.claimedAt !== null) {
            return withClearPendingCookie(
              NextResponse.json(
                redeemJson({
                  runId: row.runId,
                  terminalStatus: row.terminalStatus,
                  workloadClass: row.workloadClass,
                  subcommand: row.subcommand,
                  buildProfile: row.buildProfile,
                  claimedAt: row.claimedAt,
                }),
                { status: 200 },
              ),
            );
          }

          const redeemReserved = await reserveClaimRedeemUserSlot(tx, userId);
          if (!redeemReserved.ok) {
            throw new RateLimitedClaimRedeemUser();
          }

          const claimedAt = new Date();
          await tx
            .update(ossClaimTickets)
            .set({ userId, claimedAt })
            .where(and(eq(ossClaimTickets.secretHash, secretHash!)));

          await logFunnelEvent(
            {
              event: "oss_claim_redeemed",
              userId,
              metadata: { schema_version: 1 as const, run_id: row.runId },
            },
            tx,
          );

          return withClearPendingCookie(
            NextResponse.json(
              redeemJson({
                runId: row.runId,
                terminalStatus: row.terminalStatus,
                workloadClass: row.workloadClass,
                subcommand: row.subcommand,
                buildProfile: row.buildProfile,
                claimedAt,
              }),
              { status: 200 },
            ),
          );
        },
        { isolationLevel: "serializable" },
      ),
    );
  } catch (e) {
    if (e instanceof RateLimitedClaimRedeemUser) {
      return withClearPendingCookie(
        NextResponse.json({ code: "rate_limited", scope: "claim_redeem_user" }, { status: 429 }),
      );
    }
    console.error(e);
    return withClearPendingCookie(new NextResponse(null, { status: 503 }));
  }
}
