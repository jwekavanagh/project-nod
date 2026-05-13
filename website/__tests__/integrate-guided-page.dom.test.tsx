// @vitest-environment jsdom

import IntegrateGuidedPage from "@/app/integrate/guided/page";
import { governanceOnboardingHrefList } from "@/lib/governanceOnboardingLinks";
import marketing from "@/lib/marketing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

describe("/integrate/guided (RTL)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows static graduation before submit with check, Formalize, and paid governance path", () => {
    render(<IntegrateGuidedPage />);
    const main = screen.getByTestId("integrate-guided-page");
    expect(within(main).getByTestId("integrate-guided-graduation")).toBeTruthy();
    const t = main.textContent ?? "";
    expect(t).toContain("Formalize");
    expect(t).toContain("agentskeptic check");
    expect(t).toContain("Paid CI governance");
  });

  it("paid governance bridge lists six ordered hrefs under graduation", () => {
    render(<IntegrateGuidedPage />);
    const grad = screen.getByTestId("integrate-guided-graduation");
    const list = within(grad).getByTestId("integrate-guided-governance-steps");
    const anchors = within(list).getAllByRole("link");
    expect(anchors).toHaveLength(6);
    const expected = governanceOnboardingHrefList(marketing.gitRepositoryUrl);
    expect(anchors.map((a) => a.getAttribute("href"))).toEqual(expected);
  });

  it("POSTs registry-draft and shows tools, ndjson, and command; 404 shows operator hint", async () => {
    const payload = {
      schemaVersion: 3,
      draft: { tools: [{ toolId: "a.b", effectDescriptionTemplate: "x", verification: { kind: "sql_row" } }] },
      assumptions: [],
      warnings: [],
      disclaimer: "d",
      generation: { backend: "hosted_openai", model: "gpt-4o-mini" },
      quickIngestInput: { encoding: "utf8", body: "LINE\n" },
      readiness: { status: "ready", reasons: ["OK"] },
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    render(<IntegrateGuidedPage />);
    fireEvent.click(screen.getByTestId("integrate-guided-generate"));

    await waitFor(() => {
      expect(screen.getByTestId("integrate-guided-results")).toBeTruthy();
    });
    expect(screen.getByTestId("integrate-guided-readiness").textContent).toMatch(/ready/i);
    expect(screen.getByTestId("integrate-guided-ndjson").textContent).toBe("LINE\n");
    const nd = screen.getByTestId("integrate-guided-ndjson");
    const cmdEl = screen.getByTestId("integrate-guided-command");
    const toolsEl = screen.getByTestId("integrate-guided-tools-json");
    expect(nd.compareDocumentPosition(cmdEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(cmdEl.compareDocumentPosition(toolsEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    expect(screen.getByTestId("integrate-guided-tools-json").textContent).toContain("a.b");
    const cmd = cmdEl.textContent ?? "";
    expect(cmd.trim()).toBe(marketing.integratePage.quickVerifyCommand.trim());
    expect(cmd).toContain("agentskeptic quick");
    expect(cmd).toContain("--export-registry");
    expect(cmd).toContain("path/to/quick-input.ndjson");

    const called = fetchMock.mock.calls[0]!;
    expect(called[0]).toBe("/api/integrator/registry-draft");
    const init = called[1] as RequestInit;
    expect(init?.method).toBe("POST");
    const body = JSON.parse((init?.body as string) ?? "");
    expect(body.inputKind).toBe("openai_tool_calls_v1");
  });

  it("sets unavailable when API returns 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    render(<IntegrateGuidedPage />);
    fireEvent.click(screen.getByTestId("integrate-guided-generate"));
    await waitFor(() => {
      expect(screen.getByText(/not available on this deployment/i)).toBeTruthy();
    });
  });
});
