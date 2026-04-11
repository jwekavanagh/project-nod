import { auth } from "@/auth";
import { db } from "@/db/client";
import { funnelEvents, users } from "@/db/schema";
import {
  buildCheckoutStartedMetadata,
  type CheckoutStartedMetadata,
} from "@/lib/funnelCommercialMetadata";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { loadCommercialPlans } from "@/lib/plans";
import type { PlanId } from "@/lib/plans";
import { buildStripeCheckoutSessionCreateParams } from "@/lib/stripeCheckoutSessionParams";
import { getStripe } from "@/lib/stripeServer";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let plan: PlanId;
  let envKey: string;
  try {
    const j = (await req.json()) as { plan?: unknown };
    const raw = j.plan;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const plans = loadCommercialPlans();
    const def = plans.plans[raw as PlanId];
    if (!def) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const key = def.stripePriceEnvKey;
    if (!key) {
      return NextResponse.json({ error: "Plan not billable" }, { status: 400 });
    }
    plan = raw as PlanId;
    envKey = key;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const priceId = process.env[envKey];
  if (!priceId) {
    return NextResponse.json({ error: "Missing Stripe price env" }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

  const [urow] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const priorReserve = await db
    .select()
    .from(funnelEvents)
    .where(
      and(eq(funnelEvents.userId, session.user.id), eq(funnelEvents.event, "reserve_allowed")),
    )
    .limit(1);
  const postActivation = priorReserve.length > 0;

  const sessionParams = buildStripeCheckoutSessionCreateParams({
    stripeCustomerId: urow?.stripeCustomerId,
    customerEmail: session.user.email,
    priceId,
    baseUrl: base,
    plan,
    userId: session.user.id,
  });
  const checkout = await getStripe().checkout.sessions.create(sessionParams);

  await logFunnelEvent({
    event: "checkout_started",
    userId: session.user.id,
    metadata: buildCheckoutStartedMetadata(
      plan as CheckoutStartedMetadata["plan"],
      postActivation,
    ),
  });

  return NextResponse.json({ url: checkout.url });
}
