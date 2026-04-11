import { describe, expect, it } from "vitest";
import { buildStripeCheckoutSessionCreateParams } from "@/lib/stripeCheckoutSessionParams";

describe("buildStripeCheckoutSessionCreateParams", () => {
  const base = {
    customerEmail: "u@example.com",
    priceId: "price_123",
    baseUrl: "https://app.example.com",
    plan: "individual" as const,
    userId: "user-1",
  };

  it("uses customer and omits customer_email when stripeCustomerId is non-empty", () => {
    const p = buildStripeCheckoutSessionCreateParams({
      ...base,
      stripeCustomerId: "cus_abc",
    });
    expect(p.customer).toBe("cus_abc");
    expect("customer_email" in p).toBe(false);
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price: "price_123", quantity: 1 }]);
    expect(p.metadata).toEqual({ userId: "user-1", plan: "individual" });
    expect(p.success_url).toContain("expectedPlan=individual");
    expect(p.cancel_url).toBe("https://app.example.com/pricing");
  });

  it("trims stripeCustomerId", () => {
    const p = buildStripeCheckoutSessionCreateParams({
      ...base,
      stripeCustomerId: "  cus_x  ",
    });
    expect(p.customer).toBe("cus_x");
    expect("customer_email" in p).toBe(false);
  });

  it("uses customer_email and omits customer when stripeCustomerId is empty", () => {
    const p = buildStripeCheckoutSessionCreateParams({
      ...base,
      stripeCustomerId: "",
    });
    expect(p.customer_email).toBe("u@example.com");
    expect("customer" in p).toBe(false);
  });

  it("uses customer_email when stripeCustomerId is null or undefined", () => {
    for (const stripeCustomerId of [null, undefined]) {
      const p = buildStripeCheckoutSessionCreateParams({
        ...base,
        stripeCustomerId,
      });
      expect(p.customer_email).toBe("u@example.com");
      expect("customer" in p).toBe(false);
    }
  });

  it("uses customer_email when stripeCustomerId is whitespace only", () => {
    const p = buildStripeCheckoutSessionCreateParams({
      ...base,
      stripeCustomerId: "   \t  ",
    });
    expect(p.customer_email).toBe("u@example.com");
    expect("customer" in p).toBe(false);
  });

  it("strips trailing slash from baseUrl", () => {
    const p = buildStripeCheckoutSessionCreateParams({
      ...base,
      baseUrl: "https://app.example.com/",
      stripeCustomerId: null,
    });
    expect(p.success_url).toBe(
      "https://app.example.com/account?checkout=success&expectedPlan=individual",
    );
    expect(p.cancel_url).toBe("https://app.example.com/pricing");
  });
});
