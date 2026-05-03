import { describe, expect, it, vi } from "vitest";
import { postPublicVerificationReport } from "./postPublicVerificationReport.js";

describe("postPublicVerificationReport", () => {
  it("invokes fetch for share POST independently of product-activation telemetry consent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ schemaVersion: 3, id: "rid", url: "https://example.com/r/rid" }),
    });
    const r = await postPublicVerificationReport(
      "https://example.com",
      {
        schemaVersion: 3,
        certificate: { schemaVersion: 3 } as never,
      },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain("/api/public/verification-reports");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.id).toBe("rid");
    }
  });
});
