// @vitest-environment jsdom

import IntegratePage from "@/app/integrate/page";
import marketing from "@/lib/marketing";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Expected accessible names — literals live only here (v2 /integrate layout). */
const EXPECT_PRIMARY_TRUTH_H2 = "Truth check (primary)";
const EXPECT_ADVANCED_ACTIVATION_H2 = "Exportable activation and packs (advanced)";
const EXPECT_PRODUCT_WIRE_H2 = "Product completion: wire your emitters";

const FORBIDDEN_IN_MAIN = [
  "What success looks like",
  "successHeading",
  "IntegrateSpineComplete alone satisfies Decision-ready ProductionComplete",
];

vi.mock("@/components/FunnelSurfaceBeacon", () => ({
  FunnelSurfaceBeacon: () => null,
}));

describe("/integrate completion semantics (RTL)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("truth-check is primary h2; advanced activation h2; wire emitters h2; framework spine section contains init block; main omits forbidden phrases", () => {
    const { container } = render(<IntegratePage />);
    const main = screen.getByRole("main");
    const h2s = within(main).getAllByRole("heading", { level: 2 });
    expect(h2s[0]?.textContent).toBe(EXPECT_PRIMARY_TRUTH_H2);
    expect(h2s[1]?.textContent).toBe(EXPECT_ADVANCED_ACTIVATION_H2);
    const quickPre = within(main).getByTestId("integrate-first-proof-quick");
    const truthPre = within(main).getByTestId("integrate-truth-check-commands");
    const guidedCta = within(main).getByTestId("integrate-guided-cta");
    const crossingPre = within(main).getByTestId("integrate-crossing-commands");
    expect(
      quickPre.compareDocumentPosition(truthPre) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      truthPre.compareDocumentPosition(guidedCta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      guidedCta.compareDocumentPosition(crossingPre) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(truthPre.compareDocumentPosition(crossingPre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect((quickPre.textContent ?? "").trim()).toBe(marketing.integratePage.quickVerifyCommand.trim());
    expect(within(main).getByRole("heading", { level: 2, name: EXPECT_PRODUCT_WIRE_H2 })).toBeTruthy();
    expect(within(main).queryByRole("heading", { level: 2, name: "Mechanical spine checkpoint (not product completion)" })).toBeNull();

    const spine = container.querySelector("section.integrate-optional-spine");
    expect(spine).toBeTruthy();
    const activation = container.querySelector('[data-testid="integrator-activation-commands"]');
    expect(activation).toBeTruthy();
    expect(spine?.contains(activation)).toBe(true);

    const aggregate = main.textContent ?? "";
    expect(aggregate.includes("Formalize")).toBe(true);
    for (const bad of FORBIDDEN_IN_MAIN) {
      expect(aggregate.includes(bad)).toBe(false);
    }
    expect(container.querySelector('[data-testid="integrate-crossing-commands"]')).toBeTruthy();
    const guided = container.querySelector('[data-testid="integrate-guided-link"]');
    expect(guided).toBeTruthy();
    expect((guided as HTMLAnchorElement).getAttribute("href")).toBe("/integrate/guided");
  });
});
