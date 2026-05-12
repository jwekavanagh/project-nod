// @vitest-environment jsdom

import IntegratePage from "@/app/integrate/page";
import {
  INTEGRATE_CI_BULLET_1,
  INTEGRATE_CI_BULLET_2,
  INTEGRATE_CI_BULLET_3,
  INTEGRATE_CI_INTRO_NORMALIZED,
  INTEGRATE_H2_CI,
  INTEGRATE_H2_PREVIEW,
  INTEGRATE_LINK_LABEL_AMBIENT_CI,
} from "@/content/integrateAdoptionCopy";
import marketing from "@/lib/marketing";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const FORBIDDEN_IN_MAIN = [
  "What success looks like",
  "successHeading",
  "IntegrateSpineComplete alone satisfies Decision-ready ProductionComplete",
  "QuickVerifyReport",
  "agentskeptic activate",
  "agentskeptic crossing",
  "agentskeptic init",
  "telemetry",
  "funnel",
];

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

vi.mock("@/components/FunnelSurfaceBeacon", () => ({
  FunnelSurfaceBeacon: () => null,
}));

describe("/integrate completion semantics (RTL)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("canonical check pre, section order, adoption ladder copy, and no competing first-run paths", () => {
    const { container } = render(<IntegratePage />);
    const main = screen.getByRole("main");
    const h2s = within(main).getAllByRole("heading", { level: 2 });
    expect(h2s.map((h) => h.textContent)).toEqual([
      INTEGRATE_H2_PREVIEW,
      INTEGRATE_H2_CI,
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

    const flat = norm(main.textContent ?? "");
    expect(flat).toContain("agentskeptic quick");
    expect(flat).toContain("SQL-only preview");
    expect(flat).toContain("agentskeptic check");
    expect(flat).toContain("decision-grade");
    expect(flat).toContain("Outcome Certificate");
    expect(flat).toContain("truth_check_verdict");
    expect(flat).toContain("release_critical_truth_check_verdict");
    expect(flat).toContain("CI and release gates");
    expect(flat).toContain("Optional coverage budgets");
    expect(flat).toContain(INTEGRATE_CI_INTRO_NORMALIZED);
    expect(flat).toContain(INTEGRATE_CI_BULLET_1);
    expect(flat).toContain(INTEGRATE_CI_BULLET_2);
    expect(flat).toContain(INTEGRATE_CI_BULLET_3);
    expect(flat).toContain(INTEGRATE_LINK_LABEL_AMBIENT_CI);

    expect(container.innerHTML).toContain("docs/integrate.md#optional-coverage-budgets");
    expect(container.innerHTML).toContain("docs/ambient-ci-distribution.md");

    const aggregate = main.textContent ?? "";
    for (const bad of FORBIDDEN_IN_MAIN) {
      expect(aggregate.includes(bad)).toBe(false);
    }
  });
});
