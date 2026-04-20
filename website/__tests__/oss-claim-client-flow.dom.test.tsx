/** @vitest-environment jsdom */

import { OssClaimClient } from "@/components/OssClaimClient";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUseSession, mockUseSearchParams } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockUseSearchParams: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: mockUseSearchParams,
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

describe("OssClaimClient flow", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockUseSession.mockReset();
    mockUseSearchParams.mockReset();
  });

  it("POSTs claim-redeem with {} when authenticated and no URL error", async () => {
    const sp = new URLSearchParams();
    mockUseSearchParams.mockReturnValue(sp);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          schema_version: 1,
          run_id: "run-dom-1",
          terminal_status: "complete",
          workload_class: "non_bundled",
          subcommand: "batch_verify",
          build_profile: "oss",
          claimed_at: new Date().toISOString(),
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "u-dom", email: "dom@example.com", name: null, image: null } },
      update: vi.fn(),
    });

    render(<OssClaimClient /> as ReactElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/oss/claim-redeem");
    expect(JSON.parse(init.body as string)).toEqual({});
    expect(init.credentials).toBe("include");
  });

  it("does not POST claim-redeem when URL has handoff error", async () => {
    const sp = new URLSearchParams("error=handoff_used");
    mockUseSearchParams.mockReturnValue(sp);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "u2", email: "x@y.com", name: null, image: null } },
      update: vi.fn(),
    });

    render(<OssClaimClient /> as ReactElement);

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("does not reference sessionStorage for claim handoff", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const sp = new URLSearchParams();
    mockUseSearchParams.mockReturnValue(sp);

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "claim_failed" }), { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    mockUseSession.mockReturnValue({
      status: "authenticated",
      data: { user: { id: "u2", email: "x@y.com", name: null, image: null } },
      update: vi.fn(),
    });

    render(<OssClaimClient /> as ReactElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
