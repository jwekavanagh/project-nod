/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VerifyPageClient } from "@/app/verify/VerifyPageClient";
import minimalShare from "@/content/embeddedReports/minimal-share-v3-envelope.json";
import { EXAMPLE_WF_MISSING_NDJSON } from "@/lib/verifyDefaultSample";
import { bundledOutcomeCertificateSchema } from "@/lib/verifyBundled.contract";

function mockFetch(implementation: (input: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(implementation) as unknown as typeof fetch);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VerifyPageClient a11y", () => {
  it("disables run button while loading", async () => {
    mockFetch(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        }),
    );
    render(<VerifyPageClient />);
    const btn = screen.getByRole("button", { name: "Run verification" });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it("shows API errors in alert region", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ ok: false, error: "VERIFY_ENGINE_FAILED" }), {
          status: 500,
          headers: { "x-request-id": "test-req-1" },
        }),
    );
    render(<VerifyPageClient />);
    fireEvent.click(screen.getByRole("button", { name: "Run verification" }));
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Verification failed");
      expect(alert).toHaveTextContent("Request ID:");
      expect(alert).toHaveTextContent("test-req-1");
    });
  });

  it("renders contradiction headline on successful default response", async () => {
    const certificate = bundledOutcomeCertificateSchema.parse(
      (minimalShare as { certificate: unknown }).certificate,
    );
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            workflowId: "wf_missing",
            humanReport: certificate.humanReport,
            certificate,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    render(<VerifyPageClient />);
    expect(screen.getByRole("textbox", { name: /paste ndjson event log/i })).toHaveValue(EXAMPLE_WF_MISSING_NDJSON);
    fireEvent.click(screen.getByRole("button", { name: "Run verification" }));
    await waitFor(() => {
      expect(screen.getByTestId("verify-paste-trust-pill")).toHaveTextContent("NOT TRUSTED");
      expect(screen.getByTestId("remediation-verdict-label")).toHaveTextContent("Reality contradicts the claim");
      expect(screen.getByText(/could not verify the expected contact state in the mocked store/i)).toBeTruthy();
      expect(screen.getByTestId("verify-paste-demo-next-action")).toHaveTextContent(
        "Review the evidence completeness block and workflow truth report, then decide on a manual fix path.",
      );
      expect(screen.getByTestId("remediation-primary-action")).toHaveTextContent(
        certificate.evidenceCompleteness.nextActions[0]?.text ?? "",
      );
    });
    expect(certificate.humanReport).toContain("Expected row is missing.");
  });
});
