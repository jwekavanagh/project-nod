/** @vitest-environment jsdom */

import { OssClaimClient } from "@/components/OssClaimClient";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUseSession } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
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

const secretHex = "ab".repeat(32);

describe("OssClaimClient flow", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockUseSession.mockReset();
  });

  it("POSTs claim-pending before claim-redeem, strips hash via replaceState, redeem body is {}", async () => {
    const replaceState = vi.fn();
    vi.stubGlobal("history", { ...window.history, replaceState });

    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        hash: `#${secretHex}`,
        pathname: "/claim",
        search: "",
        href: `http://localhost/claim#${secretHex}`,
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
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
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(replaceState).toHaveBeenCalled();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [url1, init1] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url1).toBe("/api/oss/claim-pending");
    expect(JSON.parse(init1.body as string)).toEqual({ claim_secret: secretHex });
    expect(init1.credentials).toBe("include");

    const [url2, init2] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url2).toBe("/api/oss/claim-redeem");
    expect(JSON.parse(init2.body as string)).toEqual({});
    expect(init2.credentials).toBe("include");

    await waitFor(() => {
      expect(replaceState).toHaveBeenCalledWith(null, "", "/claim");
    });
  });

  it("does not reference sessionStorage for claim handoff", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    vi.stubGlobal("history", { ...window.history, replaceState: vi.fn() });
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        hash: `#${secretHex}`,
        pathname: "/claim",
        search: "",
        href: `http://localhost/claim#${secretHex}`,
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
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
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
