import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCommercialAccountStatePayload } from "@/lib/commercialAccountState";

describe("buildCommercialAccountStatePayload billingPriceSyncHint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is null when price maps", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_ok");
    const p = buildCommercialAccountStatePayload({
      plan: "individual",
      subscriptionStatus: "active",
      stripePriceId: "price_ok",
      expectedPlan: null,
    });
    expect(p.priceMapping).toBe("mapped");
    expect(p.billingPriceSyncHint).toBeNull();
  });

  it("includes subscription price id and plan env key when unmapped", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_other");
    const p = buildCommercialAccountStatePayload({
      plan: "individual",
      subscriptionStatus: "active",
      stripePriceId: "price_on_subscription",
      expectedPlan: null,
    });
    expect(p.priceMapping).toBe("unmapped");
    expect(p.billingPriceSyncHint).toEqual({
      subscriptionStripePriceId: "price_on_subscription",
      planStripePriceEnvKey: "STRIPE_PRICE_INDIVIDUAL",
    });
  });

  it("uses null planStripePriceEnvKey for starter", () => {
    const p = buildCommercialAccountStatePayload({
      plan: "starter",
      subscriptionStatus: "active",
      stripePriceId: "price_orphan",
      expectedPlan: null,
    });
    expect(p.priceMapping).toBe("unmapped");
    expect(p.billingPriceSyncHint?.planStripePriceEnvKey).toBeNull();
  });
});
