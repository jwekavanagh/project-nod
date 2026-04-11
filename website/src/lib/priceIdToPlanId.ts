import { loadCommercialPlans, type PlanId } from "@/lib/plans";

/**
 * Map Stripe Price id → commercial `PlanId` using env keys from `config/commercial-plans.json`.
 */
export function priceIdToPlanId(priceId: string | null | undefined): PlanId | null {
  if (!priceId || priceId.trim() === "") return null;
  const plans = loadCommercialPlans();
  for (const planId of Object.keys(plans.plans) as PlanId[]) {
    const def = plans.plans[planId];
    const key = def.stripePriceEnvKey;
    if (!key) continue;
    const envPrice = process.env[key];
    if (envPrice && envPrice === priceId) return planId;
  }
  return null;
}

/**
 * Primary recurring price id from a Stripe Subscription object.
 */
export function primarySubscriptionPriceId(sub: {
  items?: { data?: Array<{ price?: { id?: string } | string | null }> };
}): string | null {
  const item0 = sub.items?.data?.[0];
  if (!item0?.price) return null;
  const p = item0.price;
  return typeof p === "string" ? p : (p.id ?? null);
}
