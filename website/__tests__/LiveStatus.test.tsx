/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveStatus } from "@/components/LiveStatus";

afterEach(() => {
  cleanup();
});

describe("LiveStatus", () => {
  it("renders nothing when children are null", () => {
    const { container } = render(<LiveStatus mode="polite">{null}</LiveStatus>);
    expect(container.firstChild).toBeNull();
  });

  it("assertive mode uses role=alert", () => {
    render(
      <LiveStatus mode="assertive">
        <span>Err</span>
      </LiveStatus>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Err");
  });

  it("polite mode uses aria-live=polite and aria-atomic=true", () => {
    const { container } = render(
      <LiveStatus mode="polite">
        <span>Ok</span>
      </LiveStatus>,
    );
    const live = container.querySelector("[aria-live=polite]");
    expect(live).toBeTruthy();
    expect(live).toHaveAttribute("aria-atomic", "true");
    expect(live).toHaveTextContent("Ok");
  });
});
