import { db } from "@/db/client";
import { apiKeys, usageCounters, users } from "@/db/schema";
import { loadCommercialPlans, type PlanId } from "@/lib/plans";
import { overagePriceIdToPlanId } from "@/lib/priceIdToPlanId";
import { getStripe } from "@/lib/stripeServer";
import { and, eq, inArray, isNotNull, sum } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/** Cron-invoked; must not be statically prerendered. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function ymNowUtc(): string {
  return new Date().toISOString().slice(0, 7);
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return false;
  }
  return auth.slice(7).trim() === secret;
}

async function runReconcile(): Promise<NextResponse> {
  const planCfg = loadCommercialPlans();
  const yearMonth = ymNowUtc();
  const stripe = getStripe();

  const urows = await db
    .select({
      id: users.id,
      plan: users.plan,
      subId: users.stripeSubscriptionId,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.stripeSubscriptionId),
        eq(users.subscriptionStatus, "active"),
        inArray(users.plan, ["individual", "team", "business"]),
      ),
    );

  let ok = 0;
  const errors: { userId: string; message: string }[] = [];

  for (const u of urows) {
    const planId = u.plan as PlanId;
    const def = planCfg.plans[planId];
    if (!def?.allowOverage || def.includedMonthly === null) {
      continue;
    }
    const included = def.includedMonthly;

    const krows = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.userId, u.id));
    const keyIds = krows.map((k) => k.id);
    let total = 0;
    if (keyIds.length > 0) {
      const [row] = await db
        .select({ t: sum(usageCounters.count) })
        .from(usageCounters)
        .where(
          and(
            inArray(usageCounters.apiKeyId, keyIds),
            eq(usageCounters.yearMonth, yearMonth),
          ),
        );
      total = Number(row?.t ?? 0);
    }

    const overage = Math.max(0, total - included);

    try {
      if (!u.subId) {
        continue;
      }
      const sub = await stripe.subscriptions.retrieve(u.subId, {
        expand: ["items.data.price"],
      });
      const items = sub.items.data;
      let meteredItem: (typeof items)[0] | undefined;
      for (const it of items) {
        const pr = it.price;
        const pid = typeof pr === "string" ? pr : (pr as { id?: string })?.id;
        if (pid && overagePriceIdToPlanId(pid) === planId) {
          meteredItem = it;
          break;
        }
      }
      if (!meteredItem) {
        console.error(
          JSON.stringify({
            kind: "overage_reconcile_no_metered_item",
            userId: u.id,
            plan: planId,
            subscription: u.subId,
          }),
        );
        continue;
      }

      const ts = Math.floor(Date.now() / 1000);
      await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
        quantity: overage,
        timestamp: ts,
        action: "set",
      });
      ok += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ userId: u.id, message });
      console.error(
        JSON.stringify({ kind: "overage_reconcile_stripe_error", userId: u.id, error: message }),
      );
    }
  }

  return NextResponse.json({ ok: true, yearMonth, reported: ok, errorCount: errors.length });
}

/**
 * Reports current-month **overage** counts to Stripe metered line items. Idempotent: `action: "set"`.
 * Secured with `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return runReconcile();
}

/** Vercel Cron issues GET. Same auth and body as POST. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  return runReconcile();
}
