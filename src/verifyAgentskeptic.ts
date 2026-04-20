import { existsSync } from "node:fs";
import path from "node:path";
import { verifyWorkflow } from "./pipeline.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { VerificationDatabase } from "./types.js";
import type { WorkflowResult } from "./types.js";

const POSTGRES_URL_RE = /^postgres(ql)?:\/\//i;

const PROJECT_LAYOUT_MISSING = "PROJECT_VERIFICATION_LAYOUT_MISSING" as const;

function verificationDatabaseFromUrl(databaseUrl: string, projectRoot: string): VerificationDatabase {
  if (POSTGRES_URL_RE.test(databaseUrl)) {
    return { kind: "postgres", connectionString: databaseUrl };
  }
  return { kind: "sqlite", path: path.resolve(projectRoot, databaseUrl) };
}

/**
 * Default adoption path: reads `agentskeptic/events.ndjson` and `agentskeptic/tools.json`
 * under `projectRoot`, verifies `workflowId` against `databaseUrl` (SQLite path or postgres URL).
 * For arbitrary paths use `verifyWorkflow` instead.
 */
export async function verifyAgentskeptic(options: {
  workflowId: string;
  databaseUrl: string;
  projectRoot?: string;
}): Promise<{ ok: boolean; result: WorkflowResult }> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const resolvedRoot = path.resolve(projectRoot);
  const agentskepticDir = path.join(resolvedRoot, "agentskeptic");
  const eventsPath = path.join(agentskepticDir, "events.ndjson");
  const registryPath = path.join(agentskepticDir, "tools.json");

  if (!existsSync(eventsPath) || !existsSync(registryPath)) {
    throw new TruthLayerError(
      PROJECT_LAYOUT_MISSING,
      `${eventsPath}, ${registryPath}`,
    );
  }

  const database = verificationDatabaseFromUrl(options.databaseUrl, resolvedRoot);
  const result = await verifyWorkflow({
    workflowId: options.workflowId,
    eventsPath,
    registryPath,
    database,
    logStep: () => {},
    truthReport: () => {},
  });

  const ok = result.status === "complete";
  return { ok, result };
}
