import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  buildCommercialAccountStatePayload,
  isInvalidExpectedPlanQuery,
  normalizeSubscriptionStatusForAccount,
  parseExpectedPlanQuery,
} from "@/lib/commercialAccountState";
import type { PlanId } from "@/lib/plans";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawExpected = req.nextUrl.searchParams.get("expectedPlan");
  if (isInvalidExpectedPlanQuery(rawExpected)) {
    return NextResponse.json({ error: "Invalid expectedPlan" }, { status: 400 });
  }
  const expectedPlan = parseExpectedPlanQuery(rawExpected);

  const [row] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = buildCommercialAccountStatePayload({
    plan: row.plan as PlanId,
    subscriptionStatus: normalizeSubscriptionStatusForAccount(row.subscriptionStatus),
    stripePriceId: row.stripePriceId,
    stripeCustomerId: row.stripeCustomerId,
    expectedPlan,
    operatorContactEmail: process.env.CONTACT_SALES_EMAIL,
  });

  return NextResponse.json(payload);
}
