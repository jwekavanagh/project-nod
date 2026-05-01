import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentSkeptic } from "agentskeptic";
import { runBundledContractVerify } from "@/lib/bundledContractVerify";

describe("runBundledContractVerify", () => {
  const verify = vi.spyOn(AgentSkeptic.prototype, "verify");
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    verify.mockReset();
    consoleError.mockClear();
  });

  afterEach(() => {
    vi.mocked(verify).mockRestore();
    consoleError.mockRestore();
  });

  it("logs before BundledVerifyEngineFailedError when AgentSkeptic.verify throws", async () => {
    verify.mockRejectedValue(new Error("injected-failure"));
    await expect(
      runBundledContractVerify({
        kind: "scenarioFile",
        workflowId: "wf_complete",
      }),
    ).rejects.toThrow();
    expect(consoleError).toHaveBeenCalled();
    const first = consoleError.mock.calls[0] as [string, { workflowId: string; err: unknown }];
    expect(first[0]).toBe("[runBundledContractVerify]");
    expect(first[1].workflowId).toBe("wf_complete");
    expect((first[1].err as Error).message).toBe("injected-failure");
  });
});
