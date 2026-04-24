import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { activationJson, activationReserveDeny } from "@/lib/activationHttp";
import { db } from "@/db/client";
import { apiKeys, usageCounters, usageReservations, users } from "@/db/schema";
import { sha256HexApiKeyLookupFingerprint, verifyApiKey } from "@/lib/apiKeyCrypto";
import {
  resolveCommercialEntitlement,
  type ReserveIntent,
  type SubscriptionStatusForEntitlement,
} from "@/lib/commercialEntitlement";
import { loadCommercialPlans, paidEnforcementPlanIds, type PlanId } from "@/lib/plans";
import { buildReserveAllowedMetadata } from "@/lib/funnelCommercialMetadata";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";
import { billingPriceUnmappedMessage } from "@/lib/billingPriceUnmappedMessage";
import { priceIdToPlanId } from "@/lib/priceIdToPlanId";

function ymNow(): string {
  return new Date().toISOString().slice(0, 7);
}

function publicUpgradeUrl(): string {
  const base = getCanonicalSiteOrigin().replace(/\/$/, "");
  return `${base}/pricing`;
}

/**
 * @param usedTotal — count after a successful reservation, or count on duplicate (uncharged).
 * @param included — cap from plan; `null` means unlimited (enterprise).
 */
function reserveAllowedPayload(
  planId: PlanId,
  usedTotal: number,
  included: number | null,
): {
  allowed: true;
  plan: PlanId;
  limit: number;
  used: number;
  included_monthly: number | null;
  overage_count: number;
} {
  if (included === null) {
    return {
      allowed: true,
      plan: planId,
      limit: usedTotal,
      used: usedTotal,
      included_monthly: null,
      overage_count: 0,
    };
  }
  const overage = Math.max(0, usedTotal - included);
  return {
    allowed: true,
    plan: planId,
    limit: included,
    used: usedTotal,
    included_monthly: included,
    overage_count: overage,
  };
}

function parseIntent(raw: unknown): ReserveIntent | null {
  if (raw === undefined || raw === null) return "verify";
  if (raw === "verify" || raw === "enforce") return raw;
  return null;
}

function normalizeSubscriptionStatus(
  raw: string,
): SubscriptionStatusForEntitlement | null {
  if (raw === "none" || raw === "active" || raw === "inactive") return raw;
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Missing Authorization Bearer token.",
    });
  }
  const rawKey = auth.slice(7).trim();
  let body: { run_id?: string; issued_at?: string; intent?: unknown };
  try {
    body = (await req.json()) as { run_id?: string; issued_at?: string; intent?: unknown };
  } catch {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid JSON body.",
    });
  }
  const intent = parseIntent(body.intent);
  if (intent === null) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid intent.",
    });
  }
  const runId = body.run_id?.trim();
  const issuedAt = body.issued_at;
  if (!runId || runId.length > 256) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid run_id.",
    });
  }
  if (!issuedAt) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Missing issued_at.",
    });
  }
  const t = Date.parse(issuedAt);
  if (Number.isNaN(t)) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "Invalid issued_at.",
    });
  }
  if (Math.abs(Date.now() - t) > 300_000) {
    return activationReserveDeny(req, {
      status: 400,
      code: "BAD_REQUEST",
      message: "issued_at skew too large.",
    });
  }

  const lookup = sha256HexApiKeyLookupFingerprint(rawKey);
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
    return activationReserveDeny(req, {
      status: 401,
      code: "INVALID_KEY",
      message: "Unknown or revoked API key.",
    });
  }

  const ok = verifyApiKey(rawKey, row.key.keyHash);
  if (!ok) {
    return activationReserveDeny(req, {
      status: 401,
      code: "INVALID_KEY",
      message: "Invalid API key.",
    });
  }

  const plans = loadCommercialPlans();
  const planId = row.user.plan as PlanId;
  const planDef = plans.plans[planId];
  if (!planDef) {
    return activationReserveDeny(req, {
      status: 403,
      code: "SUBSCRIPTION_INACTIVE",
      message: "Invalid plan configuration.",
    });
  }

  const subNorm = normalizeSubscriptionStatus(row.user.subscriptionStatus);
  if (subNorm === null) {
    return activationReserveDeny(req, {
      status: 500,
      code: "SERVER_ERROR",
      message: "Invalid subscription_status in database.",
    });
  }

  const stripePriceIdRaw = row.user.stripePriceId?.trim();
  const needsMappedStripePrice = (paidEnforcementPlanIds as readonly string[]).includes(planId);
  if (needsMappedStripePrice && stripePriceIdRaw && priceIdToPlanId(stripePriceIdRaw) === null) {
    const upgrade_url = publicUpgradeUrl();
    console.error(
      JSON.stringify({
        kind: "reserve_billing_price_unmapped",
        stripePriceId: stripePriceIdRaw,
        plan: planId,
        subscriptionStatus: subNorm,
      }),
    );
    return activationReserveDeny(req, {
      status: 403,
      code: "BILLING_PRICE_UNMAPPED",
      message: billingPriceUnmappedMessage(stripePriceIdRaw),
      upgrade_url,
    });
  }

  const emergencyAllow = process.env.RESERVE_EMERGENCY_ALLOW === "1";
  const ent = resolveCommercialEntitlement({
    planId,
    subscriptionStatus: subNorm,
    intent,
    emergencyAllow,
  });

  if (!ent.proceedToQuota) {
    const upgrade_url = publicUpgradeUrl();
    const message =
      ent.denyCode === "ENFORCEMENT_REQUIRES_PAID_PLAN"
        ? "Enforcing correctness in workflows requires a paid plan."
        : "Subscription is not active for licensed verification or CI enforcement.";
    console.error(
      JSON.stringify({
        kind: "reserve_entitlement_deny",
        intent,
        plan: planId,
        subscriptionStatus: subNorm,
        code: ent.denyCode,
      }),
    );
    return activationReserveDeny(req, {
      status: 403,
      code: ent.denyCode,
      message,
      upgrade_url,
    });
  }

  const includedCap =
    planDef.includedMonthly === null ? null : (planDef.includedMonthly as number);
  const includedForQuota =
    includedCap === null ? Number.MAX_SAFE_INTEGER : includedCap;
  const allowOverage = planDef.allowOverage === true;

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
        return { ok: true as const, usedTotal: used, duplicate: true as const };
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

      const atOrOverIncluded = used >= includedForQuota;
      if (atOrOverIncluded && !allowOverage) {
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

      return { ok: true as const, usedTotal: newCount, duplicate: false as const };
    });

    if ("denied" in result && result.denied) {
      return activationReserveDeny(req, {
        status: 403,
        code: result.code,
        message: result.message,
      });
    }

    if (!("ok" in result) || !result.ok) {
      return activationReserveDeny(req, {
        status: 503,
        code: "SERVER_ERROR",
        message: "Reservation failed.",
      });
    }

    const body = reserveAllowedPayload(planId, result.usedTotal, includedCap);

    await logFunnelEvent({
      event: "reserve_allowed",
      userId: row.user.id,
      metadata: buildReserveAllowedMetadata(intent),
    });

    return activationJson(req, body, 200);
  } catch (e) {
    console.error(e);
    return activationReserveDeny(req, {
      status: 503,
      code: "SERVER_ERROR",
      message: "Reservation failed.",
    });
  }
}
