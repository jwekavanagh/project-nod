import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

import { AccountClient } from "./AccountClient";
import { db } from "@/db/client";
import { apiKeys, users } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  buildCommercialAccountStatePayload,
  normalizeSubscriptionStatusForAccount,
} from "@/lib/commercialAccountState";
import type { PlanId } from "@/lib/plans";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=%2Faccount");
  }

  const keys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, session.user.id), isNull(apiKeys.revokedAt)));

  const [urow] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  const initialCommercial = buildCommercialAccountStatePayload({
    plan: (urow?.plan ?? "starter") as PlanId,
    subscriptionStatus: normalizeSubscriptionStatusForAccount(urow?.subscriptionStatus),
    stripePriceId: urow?.stripePriceId,
    expectedPlan: null,
    operatorContactEmail: process.env.CONTACT_SALES_EMAIL,
  });

  const masked = keys[0] ? `wf_sk_live_****… (created)` : null;

  return (
    <main>
      <h1>Account</h1>
      <div className="card" style={{ marginTop: "1rem" }}>
        <p>
          Signed in as <strong>{session.user.email}</strong>
        </p>
        {masked && <p>API key: {masked}</p>}
      </div>
      <Suspense fallback={<div className="card" style={{ marginTop: "1rem" }}>Loading…</div>}>
        <AccountClient hasKey={keys.length > 0} initialCommercial={initialCommercial} />
      </Suspense>
    </main>
  );
}
