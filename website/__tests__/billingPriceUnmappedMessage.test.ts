import { afterEach, describe, expect, it, vi } from "vitest";
import { billingPriceUnmappedMessage } from "@/lib/billingPriceUnmappedMessage";

describe("billingPriceUnmappedMessage", () => {
  afterEach(() => {
    delete process.env.CONTACT_SALES_EMAIL;
  });

  it("includes operator email when CONTACT_SALES_EMAIL is valid", () => {
    vi.stubEnv("CONTACT_SALES_EMAIL", "ops@example.com");
    const m = billingPriceUnmappedMessage("price_xyz");
    expect(m).toContain("price_xyz");
    expect(m).toContain("ops@example.com");
    expect(m).toMatch(/STRIPE_PRICE_\*/i);
  });

  it("uses generic operator wording when contact env is missing", () => {
    const m = billingPriceUnmappedMessage("price_xyz");
    expect(m).toContain("price_xyz");
    expect(m).toContain("site operator");
  });
});
