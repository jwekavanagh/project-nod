// @vitest-environment jsdom

import IntegratePage from "@/app/integrate/page";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Expected accessible names — literals live only here (independent of productCopy exports). */
const EXPECT_CROSSING_H2 = "Cross the boundary (canonical path)";
const EXPECT_SPINE_CHECKPOINT_H3 = "Mechanical spine checkpoint (not product completion)";
const EXPECT_PRODUCT_COMPLETION_H2 = "Product completion: Step 4 on your emitters";

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

  it("crossing is primary h2; spine checkpoint is h3 inside closed details; activation commands nest under details; main omits forbidden phrases", () => {
    const { container } = render(<IntegratePage />);
    const main = screen.getByRole("main");
    const headings = within(main).getAllByRole("heading", { level: 2 });
    expect(headings[0]?.textContent).toBe(EXPECT_CROSSING_H2);
    expect(within(main).getByRole("heading", { level: 2, name: EXPECT_PRODUCT_COMPLETION_H2 })).toBeTruthy();
    expect(within(main).queryByRole("heading", { level: 2, name: EXPECT_SPINE_CHECKPOINT_H3 })).toBeNull();
    expect(within(main).getByRole("heading", { level: 3, name: EXPECT_SPINE_CHECKPOINT_H3 })).toBeTruthy();

    const details = container.querySelector("details.integrate-optional-spine");
    expect(details).toBeTruthy();
    const activation = container.querySelector('[data-testid="integrator-activation-commands"]');
    expect(activation).toBeTruthy();
    expect(details?.contains(activation)).toBe(true);

    const aggregate = main.textContent ?? "";
    for (const bad of FORBIDDEN_IN_MAIN) {
      expect(aggregate.includes(bad)).toBe(false);
    }
    expect(container.querySelector('[data-testid="integrate-crossing-commands"]')).toBeTruthy();
  });
});
