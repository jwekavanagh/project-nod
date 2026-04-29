import { runBundledContractVerify } from "./bundledContractVerify";
import type { DemoScenarioId } from "./demoScenarios";

/**
 * Runs bundled demo verification for an allowlisted workflow id.
 */
export async function runDemoVerifyScenario(scenarioId: DemoScenarioId): Promise<{
  scenarioId: DemoScenarioId;
  certificate: unknown;
  humanReport: string;
}> {
  const out = await runBundledContractVerify({ kind: "scenarioFile", workflowId: scenarioId });

  return {
    scenarioId,
    certificate: out.certificate,
    humanReport: out.humanReport,
  };
}
