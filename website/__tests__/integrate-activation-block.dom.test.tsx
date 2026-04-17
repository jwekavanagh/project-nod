// @vitest-environment jsdom

import { IntegrateActivationBlock } from "@/components/IntegrateActivationBlock";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("IntegrateActivationBlock", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("disables Copy when hypothesis is empty after trim (U1)", () => {
    render(<IntegrateActivationBlock />);
    const btn = screen.getByTestId("integrate-copy-activation-block");
    expect(btn).toBeDisabled();
    expect(screen.getByTestId("integrate-activation-pre").textContent).not.toContain(
      "export AGENTSKEPTIC_VERIFICATION_HYPOTHESIS='",
    );
  });

  it("disables Copy and omits hypothesis export when hypothesis contains double quote (U2)", () => {
    render(<IntegrateActivationBlock />);
    fireEvent.change(screen.getByTestId("integrate-hypothesis-input"), {
      target: { value: `no"quotes` },
    });
    fireEvent.blur(screen.getByTestId("integrate-hypothesis-input"));
    expect(screen.getByTestId("integrate-copy-activation-block")).toBeDisabled();
    expect(screen.getByTestId("integrate-activation-pre").textContent).not.toContain(
      "export AGENTSKEPTIC_VERIFICATION_HYPOTHESIS='",
    );
    expect(screen.getByTestId("integrate-hypothesis-error")).toBeTruthy();
  });

  it("enables Copy and includes single-quoted export when hypothesis is valid (U3)", () => {
    render(<IntegrateActivationBlock />);
    fireEvent.change(screen.getByTestId("integrate-hypothesis-input"), {
      target: { value: "Expect_crm_row_for_contact" },
    });
    const btn = screen.getByTestId("integrate-copy-activation-block");
    expect(btn).not.toBeDisabled();
    expect(screen.getByTestId("integrate-activation-pre").textContent).toContain(
      "export AGENTSKEPTIC_VERIFICATION_HYPOTHESIS='Expect_crm_row_for_contact'",
    );
  });
});
