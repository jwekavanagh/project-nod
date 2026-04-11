import { afterEach, describe, expect, it, vi } from "vitest";
import { priceIdToPlanId, primarySubscriptionPriceId } from "@/lib/priceIdToPlanId";

describe("priceIdToPlanId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null for empty input", () => {
    expect(priceIdToPlanId(null)).toBeNull();
    expect(priceIdToPlanId(undefined)).toBeNull();
    expect(priceIdToPlanId("")).toBeNull();
  });

  it("maps env-configured price ids to plan", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_ind_x");
    vi.stubEnv("STRIPE_PRICE_TEAM", "price_team_x");
    vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_bus_x");
    expect(priceIdToPlanId("price_ind_x")).toBe("individual");
    expect(priceIdToPlanId("price_team_x")).toBe("team");
    expect(priceIdToPlanId("price_bus_x")).toBe("business");
  });

  it("returns null for unknown price id", () => {
    vi.stubEnv("STRIPE_PRICE_INDIVIDUAL", "price_ind_x");
    expect(priceIdToPlanId("price_unknown")).toBeNull();
  });
});

describe("primarySubscriptionPriceId", () => {
  it("reads first item price id", () => {
    expect(
      primarySubscriptionPriceId({
        items: { data: [{ price: { id: "price_abc" } }] },
      }),
    ).toBe("price_abc");
  });

  it("handles expanded price as string", () => {
    expect(
      primarySubscriptionPriceId({
        items: { data: [{ price: "price_str" }] },
      }),
    ).toBe("price_str");
  });

  it("returns null when missing", () => {
    expect(primarySubscriptionPriceId({ items: { data: [] } })).toBeNull();
    expect(primarySubscriptionPriceId({})).toBeNull();
  });
});
