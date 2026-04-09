import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/client";
import { stripeEvents, users } from "@/db/schema";
import type { PlanId } from "@/lib/plans";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret || !sig) {
    return new NextResponse("Missing webhook configuration", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const existing = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.id, event.id))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await db.insert(stripeEvents).values({ id: event.id });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as PlanId | undefined;
      if (userId && plan) {
        await db
          .update(users)
          .set({
            plan,
            subscriptionStatus: "active",
            stripeCustomerId:
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id ?? null,
            stripeSubscriptionId:
              typeof session.subscription === "string"
                ? session.subscription
                : session.subscription?.id ?? null,
          })
          .where(eq(users.id, userId));
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await db
        .update(users)
        .set({ subscriptionStatus: "inactive" })
        .where(eq(users.stripeCustomerId, customerId));
    }
  } catch (e) {
    console.error(e);
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
