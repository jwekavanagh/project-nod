import {
  getAccountEntitlementSummary,
  type PriceMapping,
} from "@/lib/accountEntitlementSummary";
import {
  resolveCommercialEntitlement,
  type SubscriptionStatusForEntitlement,
} from "@/lib/commercialEntitlement";
import { loadCommercialPlans, type PlanId } from "@/lib/plans";
import { priceIdToPlanId } from "@/lib/priceIdToPlanId";

export function normalizeSubscriptionStatusForAccount(
  raw: string | null | undefined,
): SubscriptionStatusForEntitlement {
  if (raw === "none" || raw === "active" || raw === "inactive") return raw;
  return "none";
}

const CHECKOUT_EXPECTED_PLANS: readonly PlanId[] = ["individual", "team", "business"];

export function parseExpectedPlanQuery(raw: string | null): PlanId | null {
  if (!raw) return null;
  const decoded = decodeURIComponent(raw.trim());
  return CHECKOUT_EXPECTED_PLANS.includes(decoded as PlanId) ? (decoded as PlanId) : null;
}

/** True when the query param is present but not a valid self-serve checkout plan. */
export function isInvalidExpectedPlanQuery(raw: string | null): boolean {
  if (raw === null || raw === "") return false;
  return parseExpectedPlanQuery(raw) === null;
}

export function computePriceMapping(stripePriceId: string | null | undefined): PriceMapping {
  if (!stripePriceId) return "mapped";
  return priceIdToPlanId(stripePriceId) === null ? "unmapped" : "mapped";
}

export function computeCheckoutActivationReady(input: {
  expectedPlan: PlanId | null;
  plan: PlanId;
  subscriptionStatus: SubscriptionStatusForEntitlement;
  priceMapping: PriceMapping;
}): boolean {
  const { expectedPlan, plan, subscriptionStatus, priceMapping } = input;
  if (!expectedPlan) return false;
  if (plan !== expectedPlan) return false;
  if (subscriptionStatus !== "active") return false;
  if (priceMapping !== "mapped") return false;
  const verify = resolveCommercialEntitlement({
    planId: plan,
    subscriptionStatus,
    intent: "verify",
    emergencyAllow: false,
  });
  return verify.proceedToQuota === true;
}

/** Shown when `priceMapping` is `unmapped` so the account holder can align hosting env with Stripe. */
export type BillingPriceSyncHint = {
  subscriptionStripePriceId: string;
  /** Self-serve env var for the plan row in `commercial-plans.json`; null for starter/enterprise. */
  planStripePriceEnvKey: string | null;
};

export type CommercialAccountStatePayload = {
  plan: PlanId;
  subscriptionStatus: SubscriptionStatusForEntitlement;
  priceMapping: PriceMapping;
  entitlementSummary: string;
  checkoutActivationReady: boolean;
  /** True when `user.stripe_customer_id` is set; drives Billing Portal entry control. */
  hasStripeCustomer: boolean;
  /** Present only when Stripe price id is set but not recognized by this deployment's `STRIPE_PRICE_*` env. */
  billingPriceSyncHint: BillingPriceSyncHint | null;
};

export function computeHasStripeCustomer(stripeCustomerId: string | null | undefined): boolean {
  return typeof stripeCustomerId === "string" && stripeCustomerId.trim().length > 0;
}

export function buildCommercialAccountStatePayload(input: {
  plan: PlanId;
  subscriptionStatus: SubscriptionStatusForEntitlement;
  stripePriceId: string | null | undefined;
  stripeCustomerId?: string | null;
  expectedPlan: PlanId | null;
  operatorContactEmail?: string | null;
}): CommercialAccountStatePayload {
  const {
    plan,
    subscriptionStatus,
    stripePriceId,
    stripeCustomerId,
    expectedPlan,
    operatorContactEmail,
  } = input;
  const hasStripeCustomer = computeHasStripeCustomer(stripeCustomerId);
  const priceMapping = computePriceMapping(stripePriceId);
  const entitlementSummary = getAccountEntitlementSummary({
    planId: plan,
    subscriptionStatus,
    priceMapping,
    operatorContactEmail,
  });
  const checkoutActivationReady = computeCheckoutActivationReady({
    expectedPlan,
    plan,
    subscriptionStatus,
    priceMapping,
  });

  const trimmedPriceId = typeof stripePriceId === "string" ? stripePriceId.trim() : "";
  let billingPriceSyncHint: BillingPriceSyncHint | null = null;
  if (priceMapping === "unmapped" && trimmedPriceId.length > 0) {
    const plans = loadCommercialPlans();
    const planStripePriceEnvKey = plans.plans[plan]?.stripePriceEnvKey ?? null;
    billingPriceSyncHint = {
      subscriptionStripePriceId: trimmedPriceId,
      planStripePriceEnvKey,
    };
  }

  return {
    plan,
    subscriptionStatus,
    priceMapping,
    entitlementSummary,
    checkoutActivationReady,
    hasStripeCustomer,
    billingPriceSyncHint,
  };
}
