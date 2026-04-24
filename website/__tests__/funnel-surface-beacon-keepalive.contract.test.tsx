// @vitest-environment jsdom

import { FunnelSurfaceBeacon } from "@/components/FunnelSurfaceBeacon";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("FunnelSurfaceBeacon keepalive", () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ funnel_anon_id: "00000000-0000-4000-8000-000000000099" }),
    }),
  );

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "localStorage",
      (() => {
        let store: Record<string, string> = {};
        return {
          getItem: (k: string) => store[k] ?? null,
          setItem: (k: string, v: string) => {
            store[k] = v;
          },
          removeItem: (k: string) => {
            delete store[k];
          },
          clear: () => {
            store = {};
          },
        };
      })(),
    );
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: "http://127.0.0.1:3000",
        pathname: "/integrate",
        search: "",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("sets fetch keepalive true when funnel_anon_id already exists in localStorage", async () => {
    window.localStorage.setItem("agentskeptic_funnel_anon_id", "00000000-0000-4000-8000-000000000001");
    render(<FunnelSurfaceBeacon surface="integrate" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/funnel/surface-impression"),
      expect.objectContaining({ keepalive: true }),
    );
  });

  it("does not set keepalive on first mint (no stored id)", async () => {
    window.localStorage.clear();
    render(<FunnelSurfaceBeacon surface="integrate" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/funnel/surface-impression"),
      expect.objectContaining({ keepalive: false }),
    );
  });
});
