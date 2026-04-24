import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
import {
  ACTIVATION_PROBLEM_BASE,
  activationJsonWithId,
  activationProblem,
  activationProblemWithId,
  resolveActivationRequestId,
} from "@/lib/activationHttp";
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

function claimFailed(req: NextRequest, detail: string): NextResponse {
  return withClearPendingCookie(
    activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/claim-failed`,
      title: "Claim failed",
      detail,
      code: "CLAIM_FAILED",
    }),
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return activationProblem(req, {
      status: 401,
      type: `${ACTIVATION_PROBLEM_BASE}/unauthorized`,
      title: "Unauthorized",
      detail: "Sign in to redeem this claim.",
      code: "UNAUTHORIZED",
    });
  }

  const rawCt = req.headers.get("content-type");
  const ct = rawCt?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    return claimFailed(req, "Content-Type must be application/json.");
  }

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return claimFailed(req, "Invalid JSON.");
  }

  const parsed = ossClaimRedeemRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return claimFailed(req, "Request body failed validation.");
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
      return claimFailed(req, "Missing pending claim cookie or claim_secret in body.");
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
            return claimFailed(req, "No claim ticket matches this secret.");
          }

          const row = rows[0]!;
          const rid = row.activationRequestId;
          const now = new Date();
          if (row.expiresAt.getTime() < now.getTime()) {
            return withClearPendingCookie(
              activationProblemWithId(rid, {
                status: 400,
                type: `${ACTIVATION_PROBLEM_BASE}/claim-failed`,
                title: "Claim failed",
                detail: "This claim ticket has expired.",
                code: "CLAIM_EXPIRED",
              }),
            );
          }

          if (row.userId !== null && row.userId !== userId) {
            return withClearPendingCookie(
              activationProblemWithId(rid, {
                status: 409,
                type: `${ACTIVATION_PROBLEM_BASE}/already-claimed`,
                title: "Already claimed",
                detail: "This verification run is linked to a different account.",
                code: "ALREADY_CLAIMED",
              }),
            );
          }

          if (row.userId === userId && row.claimedAt !== null) {
            return withClearPendingCookie(
              activationJsonWithId(
                rid,
                redeemJson({
                  runId: row.runId,
                  terminalStatus: row.terminalStatus,
                  workloadClass: row.workloadClass,
                  subcommand: row.subcommand,
                  buildProfile: row.buildProfile,
                  claimedAt: row.claimedAt,
                }),
                200,
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
            activationJsonWithId(
              rid,
              redeemJson({
                runId: row.runId,
                terminalStatus: row.terminalStatus,
                workloadClass: row.workloadClass,
                subcommand: row.subcommand,
                buildProfile: row.buildProfile,
                claimedAt,
              }),
              200,
            ),
          );
        },
        { isolationLevel: "serializable" },
      ),
    );
  } catch (e) {
    if (e instanceof RateLimitedClaimRedeemUser) {
      return withClearPendingCookie(
        activationProblem(req, {
          status: 429,
          type: `${ACTIVATION_PROBLEM_BASE}/rate-limited`,
          title: "Too many requests",
          detail: "Claim redeem rate limit exceeded for this user.",
          code: "RATE_LIMITED",
        }),
      );
    }
    console.error(e);
    return withClearPendingCookie(
      activationProblem(req, {
        status: 503,
        type: `${ACTIVATION_PROBLEM_BASE}/server-error`,
        title: "Service unavailable",
        detail: "Could not complete claim redeem. Try again later.",
        code: "SERVER_ERROR",
      }),
    );
  }
}
