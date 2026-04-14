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
    "Commercial CLI verification needs a paid Individual, Team, Business, or Enterprise plan—see Pricing. Enforcement and CI locks need the same (not available on Starter).",
  "starter|active":
    "Commercial CLI verification needs a paid Individual, Team, Business, or Enterprise plan—see Pricing. Enforcement and CI locks need the same (not available on Starter).",
  "starter|inactive":
    "Commercial CLI verification needs a paid Individual, Team, Business, or Enterprise plan—see Pricing. Enforcement and CI locks need the same (not available on Starter).",
  "individual|none":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
  "individual|active":
    "Commercial CLI verification is enabled. Enforcement and CI locks are enabled.",
  "individual|inactive":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
  "team|none":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
  "team|active":
    "Commercial CLI verification is enabled. Enforcement and CI locks are enabled.",
  "team|inactive":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
  "business|none":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
  "business|active":
    "Commercial CLI verification is enabled. Enforcement and CI locks are enabled.",
  "business|inactive":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
  "enterprise|none":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
  "enterprise|active":
    "Commercial CLI verification is enabled. Enforcement and CI locks are enabled.",
  "enterprise|inactive":
    "Commercial CLI verification needs an active subscription. Enforcement and CI locks need an active subscription.",
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
  const summary = MAPPED_SUMMARY[key] ?? "";
  if (expectBoth && !summary.includes("is enabled")) {
    throw new Error(`accountEntitlementSummary drift: ${key} expected enabled copy`);
  }
  if (expectNeither && summary.includes("is enabled")) {
    throw new Error(`accountEntitlementSummary drift: ${key} expected unavailable copy`);
  }
  if (vOk !== eOk) {
    throw new Error(`accountEntitlementSummary: asymmetric verify/enforce at ${key}`);
  }
}

const UNMAPPED_SUFFIX_INTRO =
  " We could not confirm your subscription with your current plan in our billing records.";

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
