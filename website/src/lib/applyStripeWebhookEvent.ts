import { and, eq, or, isNull } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { logFunnelEvent } from "@/lib/funnelEvent";
import type { PlanId } from "@/lib/plans";
import { primarySubscriptionPriceId, priceIdToPlanId } from "@/lib/priceIdToPlanId";
import { getStripe } from "@/lib/stripeServer";
import { subscriptionStatusFromStripe } from "@/lib/stripeSubscriptionStatus";

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

function subscriptionPatchFromStripe(sub: Stripe.Subscription, priorPlan: PlanId) {
  const priceId = primarySubscriptionPriceId(sub);
  const mappedPlan = priceIdToPlanId(priceId);
  if (mappedPlan === null && priceId) {
    console.error(
      JSON.stringify({
        kind: "stripe_price_unmapped",
        priceId,
        subscriptionId: sub.id,
        customerId: customerIdOf(sub),
      }),
    );
  }
  const nextPlan: PlanId = mappedPlan ?? priorPlan;
  return {
    plan: nextPlan,
    subscriptionStatus: subscriptionStatusFromStripe(sub.status),
    stripeCustomerId: customerIdOf(sub),
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
  };
}

/**
 * Stripe webhook business logic (user updates + funnel). Caller must handle idempotency and
 * `stripe_event` insert before invoking this.
 */
export async function applyStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const subRef = session.subscription;
    const subId = typeof subRef === "string" ? subRef : subRef?.id;
    if (!userId || !subId) {
      return;
    }
    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) {
      return;
    }
    const sub = await getStripe().subscriptions.retrieve(subId, {
      expand: ["items.data.price"],
    });
    const patch = subscriptionPatchFromStripe(sub, existing.plan as PlanId);
    const updated = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    if (updated.length > 0) {
      await logFunnelEvent({
        event: "subscription_checkout_completed",
        userId,
        metadata: { plan: patch.plan },
      });
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = customerIdOf(sub);
    const rows = await db
      .select({ id: users.id, plan: users.plan })
      .from(users)
      .where(
        and(
          eq(users.stripeCustomerId, customerId),
          or(eq(users.stripeSubscriptionId, sub.id), isNull(users.stripeSubscriptionId)),
        ),
      );
    const targets = rows.length > 0 ? rows : await db.select({ id: users.id, plan: users.plan }).from(users).where(eq(users.stripeCustomerId, customerId));
    for (const row of targets) {
      const patch = subscriptionPatchFromStripe(sub, row.plan as PlanId);
      await db.update(users).set(patch).where(eq(users.id, row.id));
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = customerIdOf(sub);
    const narrowed = await db
      .update(users)
      .set({
        subscriptionStatus: "inactive",
        plan: "starter",
        stripeSubscriptionId: null,
        stripePriceId: null,
      })
      .where(and(eq(users.stripeCustomerId, customerId), eq(users.stripeSubscriptionId, sub.id)))
      .returning({ id: users.id });
    if (narrowed.length === 0) {
      await db
        .update(users)
        .set({
          subscriptionStatus: "inactive",
          plan: "starter",
          stripeSubscriptionId: null,
          stripePriceId: null,
        })
        .where(eq(users.stripeCustomerId, customerId));
    }
  }
}
