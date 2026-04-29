import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as agentskeptic from "agentskeptic";
import { runBundledContractVerify } from "@/lib/bundledContractVerify";

describe("runBundledContractVerify", () => {
  const verifyWorkflow = vi.spyOn(agentskeptic, "verifyWorkflow");
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    verifyWorkflow.mockReset();
    consoleError.mockClear();
  });

  afterEach(() => {
    vi.mocked(verifyWorkflow).mockRestore();
    consoleError.mockRestore();
  });

  it("logs before BundledVerifyEngineFailedError when verifyWorkflow throws", async () => {
    verifyWorkflow.mockRejectedValue(new Error("injected-failure"));
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
