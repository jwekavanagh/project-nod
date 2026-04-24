/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TryItSection } from "@/app/home/TryItSection";
import { productCopy } from "@/content/productCopy";

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams("demo=wf_missing"),
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoSuccessBody = readFileSync(
  path.join(__dirname, "fixtures", "demo-verify-success-wf-complete.json"),
  "utf8",
);

function mockFetch(implementation: (input: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(implementation) as unknown as typeof fetch);
}

beforeEach(() => {
  mockReplace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TryItSection a11y", () => {
  it("sets aria-busy while loading", async () => {
    mockFetch(
      () =>
        new Promise(() => {
          /* never resolves */
        }) as Promise<Response>,
    );
    render(<TryItSection initialScenarioId="wf_missing" />);
    fireEvent.click(screen.getByRole("button", { name: productCopy.tryIt.runButton }));
    const section = screen.getByTestId(productCopy.uiTestIds.tryIt);
    expect(section).toHaveAttribute("aria-busy", "true");
  });

  it("announces API errors in an alert with human title (not raw wire string alone)", async () => {
    mockFetch(async () => ({
      ok: false,
      status: 500,
      headers: new Headers({ "x-request-id": "test-req-1" }),
      text: async () => JSON.stringify({ error: "boom" }),
    } as Response));
    render(<TryItSection initialScenarioId="wf_missing" />);
    fireEvent.click(screen.getByRole("button", { name: productCopy.tryIt.runButton }));
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Something went wrong");
      expect(alert).toHaveTextContent("Request ID:");
      expect(alert).toHaveTextContent("test-req-1");
    });
  });

  it("announces success politely", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => demoSuccessBody,
    } as Response));
    render(<TryItSection initialScenarioId="wf_missing" />);
    fireEvent.click(screen.getByRole("button", { name: productCopy.tryIt.runButton }));
    await waitFor(() => {
      const polite = document.querySelector("[aria-live=polite]");
      expect(polite?.textContent).toContain(productCopy.tryIt.a11ySuccessAnnouncement);
    });
  });

  it("does not treat legacy truthReportText-only response as success", async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          ok: true,
          truthReportText: "legacy",
          workflowResult: {},
        }),
    } as Response));
    render(<TryItSection initialScenarioId="wf_missing" />);
    fireEvent.click(screen.getByRole("button", { name: productCopy.tryIt.runButton }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unexpected response");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The demo returned data this page cannot display",
    );
  });
});
