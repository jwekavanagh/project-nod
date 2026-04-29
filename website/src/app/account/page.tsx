import { Suspense } from "react";
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { AccountClient } from "./AccountClient";
import { AccountServerAboveFold } from "./AccountServerAboveFold";
import { assembleCommercialAccountState } from "@/lib/commercialAccountState";
import { loadApiKeysV2RowsForAccount } from "@/lib/loadApiKeysV2ForAccount";
import { loadAccountPageVerificationActivity } from "@/lib/funnelObservabilityQueries";
import { loadTrustDecisionBlockedActivity } from "@/lib/loadTrustDecisionBlockedActivity";
import { loadReliabilitySignalsForUser } from "@/lib/reliabilitySignals";
import { TrustPostureSection } from "./TrustPostureSection";
import Link from "next/link";

/** User session, DB, and Stripe state — must stay fresh per request. */
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    unauthorized();
  }

  const keys = await loadApiKeysV2RowsForAccount(session.user.id);

  const initialCommercial = await assembleCommercialAccountState({
    userId: session.user.id,
    expectedPlan: null,
    operatorContactEmail: process.env.CONTACT_SALES_EMAIL,
  });

  const activity = await loadAccountPageVerificationActivity(
    session.user.id,
    initialCommercial.monthlyQuota.yearMonth,
  );

  const reliability = await loadReliabilitySignalsForUser(session.user.id);
  const blockedActivity = await loadTrustDecisionBlockedActivity(session.user.id);

  const masked = keys[0] ? `${keys[0].label} · wf_sk_live_****…` : null;

  return (
    <main>
      <h1>Account</h1>
      <p>
        Governance timeline and audit export are available at{" "}
        <Link href="/account/governance">/account/governance</Link>.
      </p>
      <TrustPostureSection reliability={reliability} blockedActivity={blockedActivity} />
      <div className="card u-mt-1">
        <AccountServerAboveFold
          email={session.user.email ?? ""}
          maskedKeySummary={masked}
          showIntro={true}
        />
      </div>
      <Suspense fallback={<div className="card u-mt-1">Loading…</div>}>
        <AccountClient
          initialKeys={keys.map((k) => ({
            id: k.id,
            label: k.label,
            scopes: k.scopes ?? [],
            status: k.status,
            createdAt: k.createdAt.toISOString(),
            expiresAt: k.expiresAt?.toISOString() ?? null,
            revokedAt: k.revokedAt?.toISOString() ?? null,
            disabledAt: k.disabledAt?.toISOString() ?? null,
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          }))}
          initialCommercial={initialCommercial}
          activity={activity}
        />
      </Suspense>
    </main>
  );
}
