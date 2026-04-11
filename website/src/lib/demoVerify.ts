import { verifyWorkflow, loadSchemaValidator } from "agentskeptic";
import type { DemoScenarioId } from "./demoScenarioIds";
import { DemoFixturesMissingError, resolveRepoExamplesPaths } from "./resolveRepoExamples";

const validateWorkflowResult = loadSchemaValidator("workflow-result");

export class DemoResultSchemaMismatchError extends Error {
  readonly code = "DEMO_RESULT_SCHEMA_MISMATCH" as const;
  constructor() {
    super("Emitted workflow result failed JSON Schema");
    this.name = "DemoResultSchemaMismatchError";
  }
}

/**
 * Runs bundled demo verification for an allowlisted workflow id.
 */
export async function runDemoVerifyScenario(scenarioId: DemoScenarioId): Promise<{
  scenarioId: DemoScenarioId;
  workflowResult: unknown;
  truthReportText: string;
}> {
  let paths;
  try {
    paths = resolveRepoExamplesPaths();
  } catch (e) {
    if (e instanceof DemoFixturesMissingError) throw e;
    throw e;
  }

  let truthReportText = "";
  let workflowResult;
  try {
    workflowResult = await verifyWorkflow({
      workflowId: scenarioId,
      eventsPath: paths.eventsNdjson,
      registryPath: paths.toolsJson,
      database: { kind: "sqlite", path: paths.demoDb },
      logStep: () => {},
      truthReport: (s: string) => {
        truthReportText = s;
      },
    });
  } catch {
    throw new DemoEngineFailedError();
  }

  const serialized: unknown = JSON.parse(JSON.stringify(workflowResult));
  if (!validateWorkflowResult(serialized)) {
    throw new DemoResultSchemaMismatchError();
  }

  return {
    scenarioId,
    workflowResult: serialized,
    truthReportText,
  };
}

export class DemoEngineFailedError extends Error {
  readonly code = "DEMO_ENGINE_FAILED" as const;
  constructor() {
    super("verifyWorkflow threw");
    this.name = "DemoEngineFailedError";
  }
}
