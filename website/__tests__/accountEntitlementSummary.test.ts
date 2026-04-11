import { describe, expect, it } from "vitest";
import {
  assertAccountEntitlementSummaryTable,
  getAccountEntitlementSummary,
} from "@/lib/accountEntitlementSummary";
import type { PlanId } from "@/lib/plans";
import type { SubscriptionStatusForEntitlement } from "@/lib/commercialEntitlement";

describe("assertAccountEntitlementSummaryTable", () => {
  it("mapped copy matches resolveCommercialEntitlement for every plan and status", () => {
    expect(() => assertAccountEntitlementSummaryTable()).not.toThrow();
  });
});

describe("getAccountEntitlementSummary golden strings (mapped)", () => {
  const plans: PlanId[] = ["starter", "individual", "team", "business", "enterprise"];
  const statuses: SubscriptionStatusForEntitlement[] = ["none", "active", "inactive"];

  it.each(
    plans.flatMap((planId) =>
      statuses.map((subscriptionStatus) => ({ planId, subscriptionStatus })),
    ),
  )("$planId + $subscriptionStatus (mapped)", ({ planId, subscriptionStatus }) => {
    const got = getAccountEntitlementSummary({
      planId,
      subscriptionStatus,
      priceMapping: "mapped",
      operatorContactEmail: "ops@example.com",
    });
    expect(got).not.toContain("Stripe billing is active");
    expect(typeof got).toBe("string");
    expect(got.length).toBeGreaterThan(20);
  });
});

describe("getAccountEntitlementSummary unmapped suffix", () => {
  it("appends operator sentence with valid email", () => {
    const base = getAccountEntitlementSummary({
      planId: "individual",
      subscriptionStatus: "active",
      priceMapping: "mapped",
    });
    const unmapped = getAccountEntitlementSummary({
      planId: "individual",
      subscriptionStatus: "active",
      priceMapping: "unmapped",
      operatorContactEmail: "ops@example.com",
    });
    expect(unmapped.startsWith(base)).toBe(true);
    expect(unmapped).toContain("Contact: ops@example.com.");
  });

  it("uses fallback operator copy without valid email", () => {
    const unmapped = getAccountEntitlementSummary({
      planId: "team",
      subscriptionStatus: "inactive",
      priceMapping: "unmapped",
      operatorContactEmail: "not-an-email",
    });
    expect(unmapped).toContain("Contact the site operator.");
  });
});
