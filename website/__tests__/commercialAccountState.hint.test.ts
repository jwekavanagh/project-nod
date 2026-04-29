import {
  buildCommercialAccountStatePayload,
  computeWorstUrgency,
  emptyMonthlyQuotaForTests,
  resolveAccountPlanId,
} from "@/lib/commercialAccountState";
import { loadCommercialPlans } from "@/lib/plans";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      operatorContactEmail: "ops@example.com",
      monthlyQuota: emptyMonthlyQuotaForTests(),
    });
    expect(p.priceMapping).toBe("mapped");
    expect(p.billingPriceSyncHint).toBeNull();
  });

  it("returns support email when unmapped and operator email is valid", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_other");
    const p = buildCommercialAccountStatePayload({
      plan: "individual",
      subscriptionStatus: "active",
      stripePriceId: "price_on_subscription",
      expectedPlan: null,
      operatorContactEmail: "billing@example.com",
      monthlyQuota: emptyMonthlyQuotaForTests(),
    });
    expect(p.priceMapping).toBe("unmapped");
    expect(p.billingPriceSyncHint).toEqual({
      supportEmail: "billing@example.com",
    });
  });

  it("returns null supportEmail when operator contact is invalid", () => {
    const p = buildCommercialAccountStatePayload({
      plan: "individual",
      subscriptionStatus: "active",
      stripePriceId: "price_orphan",
      expectedPlan: null,
      operatorContactEmail: "not-an-email",
      monthlyQuota: emptyMonthlyQuotaForTests(),
    });
    expect(p.priceMapping).toBe("unmapped");
    expect(p.billingPriceSyncHint).toEqual({ supportEmail: null });
  });

  it("includes hint for starter when price is unmapped", () => {
    const p = buildCommercialAccountStatePayload({
      plan: "starter",
      subscriptionStatus: "active",
      stripePriceId: "price_orphan",
      expectedPlan: null,
      operatorContactEmail: "ops@example.com",
      monthlyQuota: emptyMonthlyQuotaForTests(),
    });
    expect(p.priceMapping).toBe("unmapped");
    expect(p.billingPriceSyncHint).toEqual({ supportEmail: "ops@example.com" });
  });
});

describe("resolveAccountPlanId", () => {
  const catalog = loadCommercialPlans();

  it("preserves known catalog plans", () => {
    expect(resolveAccountPlanId("team", catalog)).toBe("team");
  });

  it("maps corrupt or legacy ids to starter", () => {
    expect(resolveAccountPlanId("not-a-plan", catalog)).toBe("starter");
    expect(resolveAccountPlanId("", catalog)).toBe("starter");
    expect(resolveAccountPlanId(null, catalog)).toBe("starter");
  });
});

describe("computeWorstUrgency", () => {
  it("under included is ok (free / paid)", () => {
    expect(
      computeWorstUrgency(
        [{ apiKeyId: "k1", label: "API key", used: 50, limit: 1000, overageOnKey: 0 }],
        false,
      ),
    ).toBe("ok");
  });

  it("hard cap when over included and no overage (e.g. Starter)", () => {
    expect(
      computeWorstUrgency(
        [{ apiKeyId: "k1", label: "API key", used: 1000, limit: 1000, overageOnKey: 0 }],
        false,
      ),
    ).toBe("at_cap");
  });

  it("in_overage on paid with metered overage", () => {
    expect(
      computeWorstUrgency(
        [{ apiKeyId: "k1", label: "API key", used: 6000, limit: 5000, overageOnKey: 1000 }],
        true,
      ),
    ).toBe("in_overage");
  });

  it("skips null limits (enterprise) and uses positive key limits", () => {
    expect(
      computeWorstUrgency(
        [
          { apiKeyId: "k1", label: "API key", used: 0, limit: null, overageOnKey: 0 },
          { apiKeyId: "k2", label: "API key", used: 2000, limit: 2000, overageOnKey: 0 },
        ],
        false,
      ),
    ).toBe("at_cap");
  });
});
