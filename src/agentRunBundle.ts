import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgentRunRecordForBundle } from "./agentRunRecord.js";
import {
  AGENT_RUN_FILENAME,
  EVENTS_FILENAME,
  WORKFLOW_RESULT_FILENAME,
} from "./debugCorpus.js";
import type { WorkflowResult } from "./types.js";

export type WriteAgentRunBundleOptions = {
  outDir: string;
  eventsNdjson: Buffer;
  workflowResult: WorkflowResult;
  /** Defaults to `name` / `version` from package.json next to built `dist`. */
  producer?: { name: string; version: string };
  /** Defaults to `new Date().toISOString()`. */
  verifiedAt?: string;
};

function readPackageIdentity(): { name: string; version: string } {
  const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { name?: string; version?: string };
  const name = typeof pkg.name === "string" && pkg.name.length > 0 ? pkg.name : "execution-truth-layer";
  const version = typeof pkg.version === "string" && pkg.version.length > 0 ? pkg.version : "0.0.0";
  return { name, version };
}

/**
 * Write `data` to `dir/finalName` by writing a temp file in `dir` then renaming.
 * On Windows, replacing an existing file via rename may fail; then unlink final and rename again.
 */
function atomicWriteFileSync(dir: string, finalName: string, data: Buffer): void {
  const tmpName = `${finalName}.${process.pid}.${Date.now()}.tmp`;
  const tmpPath = path.join(dir, tmpName);
  const finalPath = path.join(dir, finalName);
  writeFileSync(tmpPath, data);
  try {
    try {
      renameSync(tmpPath, finalPath);
    } catch (e) {
      if (existsSync(finalPath)) {
        unlinkSync(finalPath);
        renameSync(tmpPath, finalPath);
      } else {
        throw e;
      }
    }
  } catch (e) {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* ignore */
      }
    }
    throw e;
  }
}

/**
 * Writes canonical run bundle: `events.ndjson`, `workflow-result.json`, `agent-run.json`.
 * Rename order: events → workflow-result → manifest (last).
 */
export function writeAgentRunBundle(options: WriteAgentRunBundleOptions): void {
  const resolved = path.resolve(options.outDir);
  const eventsBytes = options.eventsNdjson;
  const workflowResultBytes = Buffer.from(JSON.stringify(options.workflowResult), "utf8");
  const producer = options.producer ?? readPackageIdentity();
  const verifiedAt = options.verifiedAt ?? new Date().toISOString();
  const record = buildAgentRunRecordForBundle({
    runId: path.basename(resolved),
    workflowId: options.workflowResult.workflowId,
    producer,
    verifiedAt,
    workflowResultBytes,
    eventsBytes,
  });
  const agentRunBytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");

  mkdirSync(resolved, { recursive: true });
  atomicWriteFileSync(resolved, EVENTS_FILENAME, eventsBytes);
  atomicWriteFileSync(resolved, WORKFLOW_RESULT_FILENAME, workflowResultBytes);
  atomicWriteFileSync(resolved, AGENT_RUN_FILENAME, agentRunBytes);
}
