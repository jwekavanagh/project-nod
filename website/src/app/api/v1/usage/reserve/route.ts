import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { apiKeys, usageCounters, usageReservations, users } from "@/db/schema";
import { sha256Hex, verifyApiKey } from "@/lib/apiKeyCrypto";
import type { PlanId } from "@/lib/plans";
import { loadCommercialPlans } from "@/lib/plans";

function ymNow(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      { allowed: false, code: "BAD_REQUEST", message: "Missing Authorization Bearer token." },
      { status: 400 },
    );
  }
  const rawKey = auth.slice(7).trim();
  let body: { run_id?: string; issued_at?: string };
  try {
    body = (await req.json()) as { run_id?: string; issued_at?: string };
  } catch {
    return NextResponse.json(
      { allowed: false, code: "BAD_REQUEST", message: "Invalid JSON body." },
      { status: 400 },
    );
  }
  const runId = body.run_id?.trim();
  const issuedAt = body.issued_at;
  if (!runId || runId.length > 256) {
    return NextResponse.json(
      { allowed: false, code: "BAD_REQUEST", message: "Invalid run_id." },
      { status: 400 },
    );
  }
  if (!issuedAt) {
    return NextResponse.json(
      { allowed: false, code: "BAD_REQUEST", message: "Missing issued_at." },
      { status: 400 },
    );
  }
  const t = Date.parse(issuedAt);
  if (Number.isNaN(t)) {
    return NextResponse.json(
      { allowed: false, code: "BAD_REQUEST", message: "Invalid issued_at." },
      { status: 400 },
    );
  }
  if (Math.abs(Date.now() - t) > 300_000) {
    return NextResponse.json(
      { allowed: false, code: "BAD_REQUEST", message: "issued_at skew too large." },
      { status: 400 },
    );
  }

  const lookup = sha256Hex(rawKey);
  const keyRows = await db
    .select({
      key: apiKeys,
      user: users,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyLookupSha256, lookup), isNull(apiKeys.revokedAt)))
    .limit(1);

  const row = keyRows[0];
  if (!row) {
    return NextResponse.json(
      { allowed: false, code: "INVALID_KEY", message: "Unknown or revoked API key." },
      { status: 401 },
    );
  }

  const ok = verifyApiKey(rawKey, row.key.keyHash);
  if (!ok) {
    return NextResponse.json(
      { allowed: false, code: "INVALID_KEY", message: "Invalid API key." },
      { status: 401 },
    );
  }

  const plans = loadCommercialPlans();
  const planId = row.user.plan as PlanId;
  const planDef = plans.plans[planId];
  if (!planDef) {
    return NextResponse.json(
      { allowed: false, code: "SUBSCRIPTION_INACTIVE", message: "Invalid plan configuration." },
      { status: 403 },
    );
  }

  const limit =
    planDef.includedMonthly === null ? Number.MAX_SAFE_INTEGER : planDef.includedMonthly;
  const emergency = process.env.RESERVE_EMERGENCY_ALLOW === "1";

  const needsActiveSub =
    planId === "team" || planId === "business" || planId === "enterprise";

  if (!emergency && needsActiveSub && row.user.subscriptionStatus !== "active") {
    return NextResponse.json(
      {
        allowed: false,
        code: "SUBSCRIPTION_INACTIVE",
        message: "Subscription is not active for this plan.",
      },
      { status: 403 },
    );
  }

  const yearMonth = ymNow();

  try {
    const result = await db.transaction(async (tx) => {
      const dup = await tx
        .select()
        .from(usageReservations)
        .where(
          and(eq(usageReservations.apiKeyId, row.key.id), eq(usageReservations.runId, runId)),
        )
        .limit(1);
      if (dup.length > 0) {
        let c = await tx
          .select()
          .from(usageCounters)
          .where(
            and(
              eq(usageCounters.apiKeyId, row.key.id),
              eq(usageCounters.yearMonth, yearMonth),
            ),
          )
          .for("update");
        if (c.length === 0) {
          await tx.insert(usageCounters).values({
            apiKeyId: row.key.id,
            yearMonth,
            count: 0,
          });
          c = await tx
            .select()
            .from(usageCounters)
            .where(
              and(
                eq(usageCounters.apiKeyId, row.key.id),
                eq(usageCounters.yearMonth, yearMonth),
              ),
            )
            .for("update");
        }
        const used = c[0]?.count ?? 0;
        return {
          allowed: true as const,
          plan: planId,
          limit: limit === Number.MAX_SAFE_INTEGER ? used : limit,
          used,
        };
      }

      let locked = await tx
        .select()
        .from(usageCounters)
        .where(
          and(
            eq(usageCounters.apiKeyId, row.key.id),
            eq(usageCounters.yearMonth, yearMonth),
          ),
        )
        .for("update");

      if (locked.length === 0) {
        await tx.insert(usageCounters).values({
          apiKeyId: row.key.id,
          yearMonth,
          count: 0,
        });
        locked = await tx
          .select()
          .from(usageCounters)
          .where(
            and(
              eq(usageCounters.apiKeyId, row.key.id),
              eq(usageCounters.yearMonth, yearMonth),
            ),
          )
          .for("update");
      }

      const used = locked[0]!.count;

      if (!emergency && used >= limit) {
        return {
          denied: true as const,
          code: "QUOTA_EXCEEDED" as const,
          message: "Monthly verification quota exceeded.",
        };
      }

      await tx.insert(usageReservations).values({
        apiKeyId: row.key.id,
        runId,
      });

      const newCount = used + 1;
      await tx
        .update(usageCounters)
        .set({ count: newCount })
        .where(
          and(
            eq(usageCounters.apiKeyId, row.key.id),
            eq(usageCounters.yearMonth, yearMonth),
          ),
        );

      return {
        allowed: true as const,
        plan: planId,
        limit: limit === Number.MAX_SAFE_INTEGER ? newCount : limit,
        used: newCount,
      };
    });

    if ("denied" in result && result.denied) {
      return NextResponse.json(
        { allowed: false, code: result.code, message: result.message },
        { status: 403 },
      );
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { allowed: false, code: "SERVER_ERROR", message: "Reservation failed." },
      { status: 503 },
    );
  }
}
