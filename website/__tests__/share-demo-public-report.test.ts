/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { shareDemoOutcomeCertificate, buildPublicReportV2ClipboardString } from "@/lib/shareDemoPublicReport";

const cert = { schemaVersion: 1, workflowId: "wf_x", humanReport: "h" };

describe("shareDemoOutcomeCertificate", () => {
  const open = vi.fn();
  const writeText = vi.fn().mockResolvedValue(undefined);

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("on 201 opens url in a new tab with noopener", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({
          schemaVersion: 2,
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          url: "https://example.com/r/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        }),
      } as Response),
    );
    const out = await shareDemoOutcomeCertificate(cert, { openWindow: open, writeClipboard: writeText });
    expect(out).toEqual({
      kind: "opened",
      url: "https://example.com/r/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(open).toHaveBeenCalledWith("https://example.com/r/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("on 503 copies exact v2 JSON string to clipboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503, json: async () => ({}) } as Response));
    const out = await shareDemoOutcomeCertificate(cert, { openWindow: open, writeClipboard: writeText });
    expect(out).toEqual({ kind: "clipboard_off" });
    expect(writeText).toHaveBeenCalledWith(buildPublicReportV2ClipboardString(cert));
    const written = writeText.mock.calls[0][0] as string;
    expect(written).toBe(
      JSON.stringify({ schemaVersion: 2, certificate: cert, createdFrom: "website-demo" }, null, 2),
    );
  });

  it("on 201 with malformed json returns invalid_response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 201,
        json: async () => ({ schemaVersion: 2, id: "x" }),
      } as Response),
    );
    const out = await shareDemoOutcomeCertificate(cert, { openWindow: open, writeClipboard: writeText });
    expect(out).toEqual({ kind: "invalid_response" });
  });

  it("on 503 with clipboard error returns clipboard_failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503 } as Response));
    const failWrite = vi.fn().mockRejectedValue(new Error("denied"));
    const out = await shareDemoOutcomeCertificate(cert, { openWindow: open, writeClipboard: failWrite });
    expect(out).toEqual({ kind: "clipboard_failed" });
  });
});
