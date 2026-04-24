import {
  verifyWorkflow,
  loadSchemaValidator,
  buildOutcomeCertificateFromWorkflowResult,
} from "agentskeptic";
import type { DemoScenarioId } from "./demoScenarios";
import { DemoFixturesMissingError, resolveRepoExamplesPaths } from "./resolveRepoExamples";

const validateCertificate = loadSchemaValidator("outcome-certificate-v1");

export class DemoResultSchemaMismatchError extends Error {
  readonly code = "DEMO_RESULT_SCHEMA_MISMATCH" as const;
  constructor() {
    super("Emitted outcome certificate failed JSON Schema");
    this.name = "DemoResultSchemaMismatchError";
  }
}

/**
 * Runs bundled demo verification for an allowlisted workflow id.
 */
export async function runDemoVerifyScenario(scenarioId: DemoScenarioId): Promise<{
  scenarioId: DemoScenarioId;
  certificate: unknown;
  humanReport: string;
}> {
  let paths;
  try {
    paths = resolveRepoExamplesPaths();
  } catch (e) {
    if (e instanceof DemoFixturesMissingError) throw e;
    throw e;
  }

  let workflowResult;
  try {
    workflowResult = await verifyWorkflow({
      workflowId: scenarioId,
      eventsPath: paths.eventsNdjson,
      registryPath: paths.toolsJson,
      database: { kind: "sqlite", path: paths.demoDb },
      logStep: () => {},
      truthReport: () => {},
    });
  } catch (e) {
    console.error("[demoVerify]", { scenarioId, err: e });
    throw new DemoEngineFailedError();
  }

  const certificate = buildOutcomeCertificateFromWorkflowResult(workflowResult, "contract_sql");
  const serialized: unknown = JSON.parse(JSON.stringify(certificate));
  if (!validateCertificate(serialized)) {
    throw new DemoResultSchemaMismatchError();
  }

  return {
    scenarioId,
    certificate: serialized,
    humanReport: certificate.humanReport,
  };
}

export class DemoEngineFailedError extends Error {
  readonly code = "DEMO_ENGINE_FAILED" as const;
  constructor() {
    super("verifyWorkflow threw");
    this.name = "DemoEngineFailedError";
  }
}
