import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkoutStripePriceFromEnvKey,
  flatPriceIdFromSubscription,
  overagePriceIdToPlanId,
  priceIdToPlanId,
  stripePriceEnvCandidates,
} from "@/lib/priceIdToPlanId";

describe("priceIdToPlanId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null for empty input", () => {
    expect(priceIdToPlanId(null)).toBeNull();
    expect(priceIdToPlanId(undefined)).toBeNull();
    expect(priceIdToPlanId("")).toBeNull();
  });

  it("trims the subscription price id before matching", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_ind_x");
    expect(priceIdToPlanId("  price_ind_x  ")).toBe("individual");
  });

  it("maps env-configured monthly and yearly base price ids to plan", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_ind_x");
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL_YEARLY", "price_ind_y_l");
    vi.stubEnv("STRIPE_PRICE_TEAM", "price_team_x");
    vi.stubEnv("STRIPE_PRICE_TEAM_YEARLY", "price_team_y_l");
    vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_bus_x");
    vi.stubEnv("STRIPE_PRICE_BUSINESS_YEARLY", "price_bus_y_l");
    expect(priceIdToPlanId("price_ind_x")).toBe("individual");
    expect(priceIdToPlanId("price_ind_y_l")).toBe("individual");
    expect(priceIdToPlanId("price_team_x")).toBe("team");
    expect(priceIdToPlanId("price_bus_y_l")).toBe("business");
  });

  it("returns null for unknown price id", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_ind_x");
    expect(priceIdToPlanId("price_unknown")).toBeNull();
  });

  it("maps any comma- or whitespace-separated env price id to the plan", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_new, price_legacy");
    expect(priceIdToPlanId("price_new")).toBe("individual");
    expect(priceIdToPlanId("price_legacy")).toBe("individual");
  });

  it("checkoutStripePriceFromEnvKey uses the first listed id", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_primary, price_alt");
    expect(checkoutStripePriceFromEnvKey("STRIPE_PRICE_INDIVIDUAL")).toBe("price_primary");
  });
});

describe("overagePriceIdToPlanId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps metered overage price to plan", () => {
    vi.stubEnv("STRIPE_OVERAGE_INDIVIDUAL", "price_ov_i");
    expect(overagePriceIdToPlanId("price_ov_i")).toBe("individual");
    expect(overagePriceIdToPlanId("price_other")).toBeNull();
  });
});

describe("stripePriceEnvCandidates", () => {
  it("parses comma and whitespace lists", () => {
    expect(stripePriceEnvCandidates(" a , b  c ")).toEqual(["a", "b", "c"]);
  });

  it("returns empty for blank", () => {
    expect(stripePriceEnvCandidates("")).toEqual([]);
    expect(stripePriceEnvCandidates("  \t  ")).toEqual([]);
    expect(stripePriceEnvCandidates(null)).toEqual([]);
  });
});

describe("flatPriceIdFromSubscription", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores shuffled line order: metered overage first, then base", () => {
    vi.stubEnv("STRIPE_OVERAGE_TEAM", "price_overage_team");
    vi.stubEnv("STRIPE_PRICE_TEAM", "price_flat_team");
    const sub = {
      items: {
        data: [
          { price: { id: "price_overage_team", recurring: { usage_type: "metered" } } },
          { price: { id: "price_flat_team", recurring: { usage_type: "licensed" } } },
        ],
      },
    };
    expect(flatPriceIdFromSubscription(sub)).toBe("price_flat_team");
  });

  it("identifies overage by env mapping when price is a bare id", () => {
    vi.stubEnv("STRIPE_OVERAGE_BUSINESS", "price_ov_b");
    vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_f_b");
    const sub = {
      items: {
        data: [{ price: "price_ov_b" }, { price: "price_f_b" }],
      },
    };
    expect(flatPriceIdFromSubscription(sub)).toBe("price_f_b");
  });
});
