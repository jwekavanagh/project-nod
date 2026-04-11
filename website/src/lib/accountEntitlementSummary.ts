import {
  resolveCommercialEntitlement,
  type SubscriptionStatusForEntitlement,
} from "@/lib/commercialEntitlement";
import type { PlanId } from "@/lib/plans";

export type PriceMapping = "mapped" | "unmapped";

export type AccountEntitlementSummaryInput = {
  planId: PlanId;
  subscriptionStatus: SubscriptionStatusForEntitlement;
  priceMapping: PriceMapping;
  /** Bare email (e.g. CONTACT_SALES_EMAIL); used when priceMapping is unmapped. */
  operatorContactEmail?: string | null;
};

/**
 * Single source for account-page entitlement copy. Mirrors `resolveCommercialEntitlement`
 * (verify + enforce, emergencyAllow false); keys are exhaustive for plan × status × mapping.
 */
const MAPPED_SUMMARY: Record<`${PlanId}|${SubscriptionStatusForEntitlement}`, string> = {
  "starter|none":
    "Licensed contract verify (npm) requires a paid Individual, Team, Business, or Enterprise subscription—see Pricing. Enforce and CI lock flows require the same; Starter cannot use these features.",
  "starter|active":
    "Licensed contract verify (npm) requires a paid Individual, Team, Business, or Enterprise subscription—see Pricing. Enforce and CI lock flows require the same; Starter cannot use these features.",
  "starter|inactive":
    "Licensed contract verify (npm) requires a paid Individual, Team, Business, or Enterprise subscription—see Pricing. Enforce and CI lock flows require the same; Starter cannot use these features.",
  "individual|none":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
  "individual|active":
    "Licensed contract verify (npm) is available on this account. Enforce and CI lock flows are available on this account.",
  "individual|inactive":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
  "team|none":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
  "team|active":
    "Licensed contract verify (npm) is available on this account. Enforce and CI lock flows are available on this account.",
  "team|inactive":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
  "business|none":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
  "business|active":
    "Licensed contract verify (npm) is available on this account. Enforce and CI lock flows are available on this account.",
  "business|inactive":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
  "enterprise|none":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
  "enterprise|active":
    "Licensed contract verify (npm) is available on this account. Enforce and CI lock flows are available on this account.",
  "enterprise|inactive":
    "Licensed contract verify (npm) requires an active subscription. Enforce and CI lock flows require an active subscription.",
};

function assertMatchesResolver(
  planId: PlanId,
  subscriptionStatus: SubscriptionStatusForEntitlement,
): void {
  const verify = resolveCommercialEntitlement({
    planId,
    subscriptionStatus,
    intent: "verify",
    emergencyAllow: false,
  });
  const enforce = resolveCommercialEntitlement({
    planId,
    subscriptionStatus,
    intent: "enforce",
    emergencyAllow: false,
  });
  const key = `${planId}|${subscriptionStatus}` as keyof typeof MAPPED_SUMMARY;
  const vOk = verify.proceedToQuota;
  const eOk = enforce.proceedToQuota;
  const expectBoth = vOk && eOk;
  const expectNeither = !vOk && !eOk;
  if (expectBoth && !(MAPPED_SUMMARY[key]?.includes("is available"))) {
    throw new Error(`accountEntitlementSummary drift: ${key} expected available copy`);
  }
  if (expectNeither && MAPPED_SUMMARY[key]?.includes("is available")) {
    throw new Error(`accountEntitlementSummary drift: ${key} expected unavailable copy`);
  }
  if (vOk !== eOk) {
    throw new Error(`accountEntitlementSummary: asymmetric verify/enforce at ${key}`);
  }
}

const UNMAPPED_SUFFIX_INTRO =
  " Stripe billing is active but this deployment cannot map your price to a product plan.";

function unmappedSuffix(operatorContactEmail: string | null | undefined): string {
  const trimmed = operatorContactEmail?.trim();
  if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return `${UNMAPPED_SUFFIX_INTRO} Contact: ${trimmed}.`;
  }
  return `${UNMAPPED_SUFFIX_INTRO} Contact the site operator.`;
}

/** Dev/build: verify table matches resolver (throws if copy drifts). */
export function assertAccountEntitlementSummaryTable(): void {
  const plans: PlanId[] = ["starter", "individual", "team", "business", "enterprise"];
  const statuses: SubscriptionStatusForEntitlement[] = ["none", "active", "inactive"];
  for (const planId of plans) {
    for (const subscriptionStatus of statuses) {
      assertMatchesResolver(planId, subscriptionStatus);
    }
  }
}

export function getAccountEntitlementSummary(input: AccountEntitlementSummaryInput): string {
  const { planId, subscriptionStatus, priceMapping, operatorContactEmail } = input;
  const key = `${planId}|${subscriptionStatus}` as keyof typeof MAPPED_SUMMARY;
  const base = MAPPED_SUMMARY[key];
  if (!base) {
    throw new Error(`Missing entitlement summary for ${key}`);
  }
  if (priceMapping === "unmapped") {
    return `${base}${unmappedSuffix(operatorContactEmail ?? null)}`;
  }
  return base;
}
