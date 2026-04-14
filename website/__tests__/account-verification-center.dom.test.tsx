/** @vitest-environment jsdom */

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountClient } from "@/app/account/AccountClient";
import {
  emptyMonthlyQuotaForTests,
  type CommercialAccountStatePayload,
} from "@/lib/commercialAccountState";
import type { AccountPageVerificationActivity } from "@/lib/funnelObservabilityQueries";
import {
  accountActivityMetaLine,
  accountActivityStatusLabel,
} from "@/lib/accountVerificationActivityUi";
import { productCopy } from "@/content/productCopy";
import { API_KEY_ISSUED_PATTERN } from "@/lib/apiKeyCrypto";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh }),
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    href,
    "data-testid": dataTestId,
  }: {
    children: ReactNode;
    href: string;
    "data-testid"?: string;
  }) {
    return (
      <a href={href} data-testid={dataTestId}>
        {children}
      </a>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function baseCommercial(overrides: Partial<CommercialAccountStatePayload> = {}): CommercialAccountStatePayload {
  return {
    plan: "individual",
    subscriptionStatus: "active",
    priceMapping: "mapped",
    entitlementSummary: "Commercial CLI verification is enabled. Enforcement and CI locks are enabled.",
    checkoutActivationReady: false,
    hasStripeCustomer: true,
    billingPriceSyncHint: null,
    monthlyQuota: { ...emptyMonthlyQuotaForTests(), yearMonth: "2026-04" },
    ...overrides,
  };
}

const idleActivity: AccountPageVerificationActivity = {
  ok: true,
  rows: [],
  licensedOutcomesThisUtcMonth: 0,
};

describe("Account verification center (DOM)", () => {
  it("orders verification region and primary CTA before subscription", () => {
    render(
      <AccountClient hasKey={false} initialCommercial={baseCommercial()} activity={idleActivity} />,
    );
    const V = screen.getByTestId("account-verification-region");
    const S = screen.getByTestId("account-subscription-region");
    const cta = screen.getByTestId("account-primary-cta");
    expect(V.compareDocumentPosition(S) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(V).toContainElement(cta);
    expect(cta.compareDocumentPosition(S) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("shows Starter upgrade strip only when plan is starter", () => {
    const { rerender } = render(
      <AccountClient hasKey={false} initialCommercial={baseCommercial({ plan: "starter" })} activity={idleActivity} />,
    );
    const strip = screen.getByTestId("account-starter-upgrade");
    expect(strip.hidden).toBe(false);

    rerender(
      <AccountClient hasKey={false} initialCommercial={baseCommercial({ plan: "individual" })} activity={idleActivity} />,
    );
    expect(strip.hidden).toBe(true);
  });

  it("maps activity rows to normative labels from accountVerificationActivityUi", () => {
    const activity: AccountPageVerificationActivity = {
      ok: true,
      licensedOutcomesThisUtcMonth: 1,
      rows: [
        {
          createdAtIso: "2026-04-01T00:00:00.000Z",
          terminalStatus: "inconsistent",
          workloadClass: "non_bundled",
          subcommand: "quick_verify",
        },
      ],
    };
    render(<AccountClient hasKey={false} initialCommercial={baseCommercial()} activity={activity} />);
    expect(
      screen.getByText(accountActivityStatusLabel("inconsistent"), { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(accountActivityMetaLine("non_bundled", "quick_verify"), { exact: true }),
    ).toBeInTheDocument();
  });

  it("shows exact activityEmpty when ok, zero rows, zero month count", () => {
    render(<AccountClient hasKey={false} initialCommercial={baseCommercial()} activity={idleActivity} />);
    expect(screen.getByText(productCopy.account.activityEmpty, { exact: true })).toBeInTheDocument();
  });

  it("shows activityLoadError for ok false without LiveStatus wrapper", () => {
    render(<AccountClient hasKey={false} initialCommercial={baseCommercial()} activity={{ ok: false }} />);
    const err = screen.getByTestId("account-activity-error");
    expect(err.tagName).toBe("P");
    expect(err).toHaveClass("muted");
    expect(err).toHaveTextContent(productCopy.account.activityLoadError);
    expect(err.closest("[aria-live=\"polite\"], [role=\"alert\"]")).toBeNull();
  });

  it("trust footnote lines are non-empty and omit forbidden compliance claims", () => {
    for (const line of productCopy.account.trustFootnoteLines) {
      expect(line.length).toBeGreaterThan(10);
      expect(line).not.toMatch(/ROW_ABSENT|SOC\s*2|HIPAA/i);
    }
  });

  it("API key lifecycle: create, acknowledge, post-refresh no leak, negative", async () => {
    const issued = `wf_sk_live_${"a".repeat(64)}`;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/account/create-key") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ apiKey: issued }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const { rerender, container } = render(
      <AccountClient hasKey={false} initialCommercial={baseCommercial()} activity={idleActivity} />,
    );
    expect(API_KEY_ISSUED_PATTERN.test(container.textContent ?? "")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /generate api key/i }));
    const plain = await screen.findByTestId("api-key-plaintext");
    expect(API_KEY_ISSUED_PATTERN.test(plain.textContent ?? "")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /i['’]ve saved my key/i }));
    expect(screen.queryByTestId("api-key-plaintext")).toBeNull();
    expect(refresh).toHaveBeenCalled();

    rerender(<AccountClient hasKey initialCommercial={baseCommercial()} activity={idleActivity} />);
    expect(API_KEY_ISSUED_PATTERN.test(container.textContent ?? "")).toBe(false);

    cleanup();
    vi.restoreAllMocks();

    const { container: c2 } = render(
      <AccountClient hasKey={false} initialCommercial={baseCommercial()} activity={idleActivity} />,
    );
    expect(API_KEY_ISSUED_PATTERN.test(c2.textContent ?? "")).toBe(false);
  });
});
