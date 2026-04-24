import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as agentskeptic from "agentskeptic";
import { runDemoVerifyScenario } from "@/lib/demoVerify";
describe("runDemoVerifyScenario", () => {
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

  it("logs before DemoEngineFailedError when verifyWorkflow throws", async () => {
    verifyWorkflow.mockRejectedValue(new Error("injected-failure"));
    await expect(runDemoVerifyScenario("wf_complete")).rejects.toThrow();
    expect(consoleError).toHaveBeenCalled();
    const first = consoleError.mock.calls[0] as [string, { scenarioId: string; err: unknown }];
    expect(first[0]).toBe("[demoVerify]");
    expect(first[1].scenarioId).toBe("wf_complete");
    expect((first[1].err as Error).message).toBe("injected-failure");
  });
});
