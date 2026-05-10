// @vitest-environment jsdom

import IntegratePage from "@/app/integrate/page";
import marketing from "@/lib/marketing";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const FORBIDDEN_IN_MAIN = [
  "What success looks like",
  "successHeading",
  "IntegrateSpineComplete alone satisfies Decision-ready ProductionComplete",
  "agentskeptic quick",
  "QuickVerifyReport",
  "agentskeptic activate",
  "agentskeptic crossing",
  "agentskeptic init",
  "telemetry",
  "funnel",
];

vi.mock("@/components/FunnelSurfaceBeacon", () => ({
  FunnelSurfaceBeacon: () => null,
}));

describe("/integrate completion semantics (RTL)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("canonical check pre, section order, and no competing first-run paths", () => {
    const { container } = render(<IntegratePage />);
    const main = screen.getByRole("main");
    const h2s = within(main).getAllByRole("heading", { level: 2 });
    expect(h2s.map((h) => h.textContent)).toEqual([
      "First proof: contract truth check",
      "Before you run it",
      "Reading the verdict",
      "Next steps",
    ]);
    const truthPre = within(main).getByTestId("integrate-truth-check-commands");
    expect((truthPre.textContent ?? "").replace(/\s+/g, " ").trim()).toContain(
      marketing.integratePage.truthCheckCommand.replace(/\s+/g, " ").trim(),
    );
    expect(container.querySelector('[data-testid="integrate-first-proof-quick"]')).toBeNull();
    expect(container.querySelector('[data-testid="integrate-crossing-commands"]')).toBeNull();
    expect(container.querySelector('[data-testid="integrator-activation-commands"]')).toBeNull();

    const aggregate = main.textContent ?? "";
    for (const bad of FORBIDDEN_IN_MAIN) {
      expect(aggregate.includes(bad)).toBe(false);
    }
  });
});
