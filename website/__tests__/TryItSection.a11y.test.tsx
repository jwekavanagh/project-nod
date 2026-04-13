/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TryItSection } from "@/app/home/TryItSection";
import { productCopy } from "@/content/productCopy";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TryItSection a11y", () => {
  it("sets aria-busy while loading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }),
      ),
    );
    render(<TryItSection />);
    fireEvent.click(screen.getByRole("button", { name: productCopy.tryIt.runButton }));
    const section = screen.getByTestId(productCopy.uiTestIds.tryIt);
    expect(section).toHaveAttribute("aria-busy", "true");
  });

  it("announces errors in an alert", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: "boom" }),
      } as Response),
    );
    render(<TryItSection />);
    fireEvent.click(screen.getByRole("button", { name: productCopy.tryIt.runButton }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("boom");
    });
  });

  it("announces success politely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            truthReportText: "ok",
            workflowResult: { x: 1 },
          }),
      } as Response),
    );
    render(<TryItSection />);
    fireEvent.click(screen.getByRole("button", { name: productCopy.tryIt.runButton }));
    await waitFor(() => {
      const polite = document.querySelector("[aria-live=polite]");
      expect(polite?.textContent).toContain(productCopy.tryIt.a11ySuccessAnnouncement);
    });
  });
});
