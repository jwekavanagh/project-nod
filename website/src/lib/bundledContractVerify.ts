import {
  buildOutcomeCertificateFromWorkflowResult,
  loadSchemaValidator,
  verifyWorkflow,
} from "agentskeptic";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DemoScenarioId } from "./demoScenarios";
import { DemoFixturesMissingError, resolveRepoExamplesPaths } from "./resolveRepoExamples";

const validateCertificate = loadSchemaValidator("outcome-certificate-v1");

export class BundledVerifyResultSchemaMismatchError extends Error {
  readonly code = "BUNDLED_VERIFY_RESULT_SCHEMA_MISMATCH" as const;
  constructor() {
    super("Emitted outcome certificate failed JSON Schema");
    this.name = "BundledVerifyResultSchemaMismatchError";
  }
}

export class BundledVerifyEngineFailedError extends Error {
  readonly code = "BUNDLED_VERIFY_ENGINE_FAILED" as const;
  constructor() {
    super("verifyWorkflow threw");
    this.name = "BundledVerifyEngineFailedError";
  }
}

type BundledVerifyInput =
  | { kind: "paste"; eventsNdjson: string; workflowId: "wf_missing" }
  | { kind: "scenarioFile"; workflowId: DemoScenarioId };

export async function runBundledContractVerify(input: BundledVerifyInput): Promise<{
  workflowId: string;
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

  const eventsPath = input.kind === "scenarioFile"
    ? paths.eventsNdjson
    : await writePasteEventsTempFile(input.eventsNdjson);

  try {
    let workflowResult;
    try {
      workflowResult = await verifyWorkflow({
        workflowId: input.workflowId,
        eventsPath,
        registryPath: paths.toolsJson,
        database: { kind: "sqlite", path: paths.demoDb },
        logStep: () => {},
        truthReport: () => {},
      });
    } catch (e) {
      console.error("[runBundledContractVerify]", {
        workflowId: input.workflowId,
        err: e,
      });
      throw new BundledVerifyEngineFailedError();
    }

    const certificate = buildOutcomeCertificateFromWorkflowResult(workflowResult, "contract_sql");
    const serialized: unknown = JSON.parse(JSON.stringify(certificate));
    if (!validateCertificate(serialized)) {
      throw new BundledVerifyResultSchemaMismatchError();
    }

    return {
      workflowId: input.workflowId,
      certificate: serialized,
      humanReport: certificate.humanReport,
    };
  } finally {
    if (input.kind === "paste") {
      await rm(path.dirname(eventsPath), { recursive: true, force: true });
    }
  }
}

async function writePasteEventsTempFile(eventsNdjson: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agentskeptic-paste-verify-"));
  const suffix = randomUUID().replace(/-/g, "");
  const filePath = path.join(dir, `events-${suffix}.ndjson`);
  await writeFile(filePath, eventsNdjson, "utf8");
  // Force a readback to guarantee UTF-8 write visibility before verifyWorkflow reads.
  await readFile(filePath, "utf8");
  return filePath;
}
