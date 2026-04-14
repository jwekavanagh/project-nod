/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PricingClient, type PlanRow } from "@/app/pricing/PricingClient";
import { productCopy } from "@/content/productCopy";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({ children, href }: { children: ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  },
}));

const individualPlan: PlanRow = {
  id: "individual",
  checkoutPlanId: "individual",
  headline: "Individual",
  displayPrice: "$25/mo",
  includedMonthly: 2000,
  audience: "Solo developers.",
  valueUnlock: "Licensed verify.",
  recommended: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PricingClient checkout — no silent failures on bad responses", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "<!DOCTYPE html><html><body>Internal Server Error</body></html>",
      } as Response),
    );
  });

  it("surfaces an error when the server returns HTML instead of JSON (regression: r.json threw)", async () => {
    render(
      <PricingClient plans={[individualPlan]} enterpriseMailto="mailto:sales@example.com" />,
    );

    expect(screen.getByTestId("pricing-entry-paid-pill")).toHaveTextContent(
      productCopy.pricingIndividualEntryPill,
    );

    fireEvent.click(
      screen.getByRole("button", { name: productCopy.pricingPlanCtas.individual.checkoutLabel }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Checkout failed \(500\)/i);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/contact support/i);
  });

  it("shows a configuration hint when JSON is OK but checkout URL is missing", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    } as Response);

    render(
      <PricingClient plans={[individualPlan]} enterpriseMailto="mailto:sales@example.com" />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: productCopy.pricingPlanCtas.individual.checkoutLabel }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/payment link/i);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/Stripe configuration/i);
  });

  it("POSTs JSON to /api/checkout with same-origin credentials and leaves no error when url is returned", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        /* Hash-only avoids jsdom "Not implemented: navigation" while still exercising assign + JSON parse. */
        JSON.stringify({ url: "#vitest-checkout-success" }),
    } as Response);

    render(
      <PricingClient plans={[individualPlan]} enterpriseMailto="mailto:sales@example.com" />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: productCopy.pricingPlanCtas.individual.checkoutLabel }),
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/checkout",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: "individual" }),
        }),
      );
    });
    expect(document.querySelector(".error-text")).not.toBeInTheDocument();
  });
});
