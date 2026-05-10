import { loadCommercialPlans, type PlanId } from "@/lib/plans";

/**
 * Parse `STRIPE_PRICE_*` values: one id, or several separated by comma and/or whitespace.
 * Order is preserved; the first id is the default used for new Checkout sessions.
 */
export function stripePriceEnvCandidates(raw: string | undefined | null): string[] {
  if (raw === undefined || raw === null) return [];
  const s = raw.trim();
  if (s === "") return [];
  return s.split(/[\s,]+/).filter((x) => x.length > 0);
}

function eachBasePriceEnvName(def: {
  stripePriceEnvKeyMonthly: string | null;
  stripePriceEnvKeyYearly: string | null;
}): (string | null)[] {
  return [def.stripePriceEnvKeyMonthly, def.stripePriceEnvKeyYearly];
}

/** First configured price id for a plan env key (Checkout default line item). */
export function checkoutStripePriceFromEnvKey(envKey: string): string | null {
  const candidates = stripePriceEnvCandidates(process.env[envKey]);
  return candidates[0] ?? null;
}

export function checkoutBasePriceIdForInterval(
  planId: PlanId,
  interval: "monthly" | "yearly",
): { priceId: string | null; envKey: string | null; error: "missing" | "not_configured" } {
  const plans = loadCommercialPlans();
  const def = plans.plans[planId];
  if (!def) {
    return { priceId: null, envKey: null, error: "missing" };
  }
  const key =
    interval === "yearly" ? def.stripePriceEnvKeyYearly : def.stripePriceEnvKeyMonthly;
  if (!key) {
    return { priceId: null, envKey: null, error: "not_configured" };
  }
  const id = checkoutStripePriceFromEnvKey(key);
  if (!id) {
    return { priceId: null, envKey: key, error: "not_configured" };
  }
  return { priceId: id, envKey: key, error: "missing" };
}

export function checkoutOveragePriceId(planId: PlanId): { priceId: string | null; envKey: string | null } {
  const plans = loadCommercialPlans();
  const def = plans.plans[planId];
  if (!def?.stripeOveragePriceEnvKey) {
    return { priceId: null, envKey: null };
  }
  const k = def.stripeOveragePriceEnvKey;
  return { priceId: checkoutStripePriceFromEnvKey(k), envKey: k };
}

/**
 * Map Stripe Price id → commercial `PlanId` using env keys from `config/commercial-plans.json`
 * (base monthly/yearly; no overage line items).
 */
export function priceIdToPlanId(priceId: string | null | undefined): PlanId | null {
  const normalized = priceId?.trim();
  if (!normalized) return null;
  const plans = loadCommercialPlans();
  for (const planId of Object.keys(plans.plans) as PlanId[]) {
    const def = plans.plans[planId];
    for (const envName of eachBasePriceEnvName(def)) {
      if (!envName) continue;
      const candidates = stripePriceEnvCandidates(process.env[envName]);
      if (candidates.includes(normalized)) return planId;
    }
  }
  return null;
}

/**
 * Map a metered overage line item Price id → `PlanId`.
 */
export function overagePriceIdToPlanId(priceId: string | null | undefined): PlanId | null {
  const normalized = priceId?.trim();
  if (!normalized) return null;
  const plans = loadCommercialPlans();
  for (const planId of Object.keys(plans.plans) as PlanId[]) {
    const def = plans.plans[planId];
    const k = def.stripeOveragePriceEnvKey;
    if (!k) continue;
    const candidates = stripePriceEnvCandidates(process.env[k]);
    if (candidates.includes(normalized)) return planId;
  }
  return null;
}

/**
 * Overage (metered) line item — skip when finding the **flat** base price for `user.plan` mapping.
 */
function isOverageOrMeteredPriceId(priceId: string | null, price: unknown): boolean {
  if (priceId && overagePriceIdToPlanId(priceId) !== null) {
    return true;
  }
  if (price && typeof price === "object" && "recurring" in price) {
    const r = (price as { recurring?: { usage_type?: string } }).recurring;
    return r?.usage_type === "metered";
  }
  return false;
}

/**
 * The subscription’s **flat (licensed) recurring** base price, used to map `user.plan`.
 * Skips metered overage line items and prefers the first item whose price id maps via `priceIdToPlanId`.
 * Falls back to the first **non-metered** item, then the first item (legacy one-line subscriptions).
 * Accepts a structural subset of Stripe `Subscription` (tests and webhooks use plain shapes).
 */
export function flatPriceIdFromSubscription(sub: {
  items?: { data?: Array<{ price?: { id?: string; recurring?: { usage_type?: string | null } | null } | string | null }> } | null;
} | null): string | null {
  const data = sub?.items?.data;
  if (!data?.length) return null;

  const priceIdAt = (idx: number): string | null => {
    const p = data[idx]?.price;
    if (typeof p === "string") return p;
    return p?.id ?? null;
  };

  const unmappedNonMetered: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const raw = data[i]?.price;
    const id = priceIdAt(i);
    if (isOverageOrMeteredPriceId(id, raw)) {
      continue;
    }
    if (id && priceIdToPlanId(id)) {
      return id;
    }
    if (id) {
      unmappedNonMetered.push(id);
    }
  }

  for (let i = 0; i < data.length; i++) {
    const raw = data[i]?.price;
    const id = priceIdAt(i);
    if (isOverageOrMeteredPriceId(id, raw)) {
      continue;
    }
    if (id) {
      if (unmappedNonMetered.length > 0) {
        console.error(
          JSON.stringify({
            kind: "flat_price_fallback_unmapped",
            stripePriceId: id,
            itemIndex: i,
          }),
        );
      }
      return id;
    }
  }

  return priceIdAt(0);
}
