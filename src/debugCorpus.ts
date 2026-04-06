import { readdirSync, readFileSync, statSync, existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEventsForWorkflow } from "./loadEvents.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { TruthLayerError } from "./truthLayerError.js";
import { WORKFLOW_RESULT_RUN_LEVEL_CODES_MISMATCH_MESSAGE } from "./runLevelDriftMessages.js";
import { isV9RunLevelCodesInconsistent } from "./workflowRunLevelConsistency.js";
import type { WorkflowResult } from "./types.js";
import { normalizeToEmittedWorkflowResult } from "./workflowResultNormalize.js";
import { sha256Hex, type AgentRunRecord } from "./agentRunRecord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const WORKFLOW_RESULT_FILENAME = "workflow-result.json";
export const EVENTS_FILENAME = "events.ndjson";
export const AGENT_RUN_FILENAME = "agent-run.json";

export const DEBUG_CORPUS_CODES = {
  PATH_ESCAPE: "PATH_ESCAPE",
  MISSING_AGENT_RUN_MANIFEST: "MISSING_AGENT_RUN_MANIFEST",
  AGENT_RUN_JSON_SYNTAX: "AGENT_RUN_JSON_SYNTAX",
  AGENT_RUN_INVALID: "AGENT_RUN_INVALID",
  ARTIFACT_LENGTH_MISMATCH: "ARTIFACT_LENGTH_MISMATCH",
  ARTIFACT_INTEGRITY_MISMATCH: "ARTIFACT_INTEGRITY_MISMATCH",
  AGENT_RUN_WORKFLOW_ID_MISMATCH: "AGENT_RUN_WORKFLOW_ID_MISMATCH",
  MISSING_WORKFLOW_RESULT: "MISSING_WORKFLOW_RESULT",
  MISSING_EVENTS: "MISSING_EVENTS",
  WORKFLOW_RESULT_INVALID: "WORKFLOW_RESULT_INVALID",
  WORKFLOW_RESULT_JSON: "WORKFLOW_RESULT_JSON",
  EVENTS_LOAD_FAILED: "EVENTS_LOAD_FAILED",
} as const;

export type CorpusMeta = {
  customerId?: string;
  capturedAt?: string;
};

export type CorpusLoadError = {
  code: string;
  message: string;
  path?: string;
  details?: unknown;
};

export type CorpusRunLoadedOk = {
  loadStatus: "ok";
  runId: string;
  workflowResult: WorkflowResult;
  /** Derived from `agentRunRecord` for list facets (`customerId`, `capturedAt`). */
  meta: CorpusMeta;
  agentRunRecord: AgentRunRecord;
  capturedAtEffectiveMs: number;
  paths: { workflowResult: string; events: string; agentRun: string };
  malformedEventLineCount: number;
};

export type CorpusRunLoadedError = {
  loadStatus: "error";
  runId: string;
  error: CorpusLoadError;
  pathsTried: { workflowResult?: string; events?: string; agentRun?: string };
  rawPreview?: string;
  capturedAtEffectiveMs: number;
};

export type CorpusRunOutcome = CorpusRunLoadedOk | CorpusRunLoadedError;

const validateWorkflowResult = loadSchemaValidator("workflow-result");
const validateWorkflowResultV9 = loadSchemaValidator("workflow-result-v9");
const validateAgentRunRecord = loadSchemaValidator("agent-run-record");

function isSafeRunId(runId: string): boolean {
  if (runId === "." || runId === "..") return false;
  if (runId.includes("/") || runId.includes("\\")) return false;
  if (runId.includes("\0")) return false;
  return runId.length > 0;
}

/** True iff `targetReal` is `rootReal` or a path under it (after realpath). */
export function isPathUnderRoot(rootReal: string, targetReal: string): boolean {
  const rel = path.relative(rootReal, targetReal);
  if (rel === "") return true;
  return !rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel);
}

export function listCorpusRunIds(corpusRoot: string): string[] {
  const entries = readdirSync(corpusRoot, { withFileTypes: true });
  const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  return ids.filter(isSafeRunId).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

function mtimeMs(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function readUtf8Preview(filePath: string, maxBytes: number): string | undefined {
  try {
    const buf = readFileSync(filePath);
    const slice = buf.subarray(0, Math.min(buf.length, maxBytes));
    return slice.toString("utf8");
  } catch {
    return undefined;
  }
}

function capturedAtEffectiveMs(record: AgentRunRecord, workflowResultPath: string): number {
  if (record.capturedAt) {
    const t = Date.parse(record.capturedAt);
    if (!Number.isNaN(t)) return t;
  }
  const v = Date.parse(record.verifiedAt);
  if (!Number.isNaN(v)) return v;
  return mtimeMs(workflowResultPath);
}

function metaFromRecord(record: AgentRunRecord): CorpusMeta {
  const meta: CorpusMeta = {};
  if (record.customerId !== undefined && record.customerId !== "") meta.customerId = record.customerId;
  if (record.capturedAt !== undefined && record.capturedAt !== "") meta.capturedAt = record.capturedAt;
  return meta;
}

export function resolveCorpusRootReal(corpusRoot: string): string {
  return realpathSync(path.resolve(corpusRoot));
}

export function loadCorpusRun(corpusRootReal: string, runId: string): CorpusRunOutcome {
  const runDir = path.join(corpusRootReal, runId);
  let runDirReal: string;
  try {
    runDirReal = realpathSync(runDir);
  } catch {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.PATH_ESCAPE,
        message: `Run directory does not exist or is unreachable: ${runId}`,
        path: runDir,
      },
      pathsTried: {},
      capturedAtEffectiveMs: 0,
    };
  }

  if (!isPathUnderRoot(corpusRootReal, runDirReal)) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.PATH_ESCAPE,
        message: "Resolved run path escapes corpus root.",
        path: runDirReal,
      },
      pathsTried: {},
      capturedAtEffectiveMs: 0,
    };
  }

  const agentRunPath = path.join(runDirReal, AGENT_RUN_FILENAME);
  const workflowResultPath = path.join(runDirReal, WORKFLOW_RESULT_FILENAME);
  const eventsPath = path.join(runDirReal, EVENTS_FILENAME);

  if (!existsSync(agentRunPath)) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.MISSING_AGENT_RUN_MANIFEST,
        message: `Missing ${AGENT_RUN_FILENAME} under run folder.`,
        path: agentRunPath,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: workflowResultPath, events: eventsPath },
      capturedAtEffectiveMs: mtimeMs(workflowResultPath),
    };
  }

  let agentRunRaw: string;
  try {
    agentRunRaw = readFileSync(agentRunPath, "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.AGENT_RUN_JSON_SYNTAX,
        message: `Cannot read ${AGENT_RUN_FILENAME}: ${msg}`,
        path: agentRunPath,
      },
      pathsTried: { agentRun: agentRunPath },
      capturedAtEffectiveMs: mtimeMs(workflowResultPath),
    };
  }

  let agentRunParsed: unknown;
  try {
    agentRunParsed = JSON.parse(agentRunRaw) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.AGENT_RUN_JSON_SYNTAX,
        message: `${AGENT_RUN_FILENAME} is not valid JSON: ${msg}`,
        path: agentRunPath,
      },
      pathsTried: { agentRun: agentRunPath },
      rawPreview: readUtf8Preview(agentRunPath, 8192),
      capturedAtEffectiveMs: mtimeMs(workflowResultPath),
    };
  }

  if (!validateAgentRunRecord(agentRunParsed)) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.AGENT_RUN_INVALID,
        message: `${AGENT_RUN_FILENAME} failed agent-run-record schema validation.`,
        path: agentRunPath,
        details: validateAgentRunRecord.errors ?? [],
      },
      pathsTried: { agentRun: agentRunPath },
      rawPreview: readUtf8Preview(agentRunPath, 8192),
      capturedAtEffectiveMs: mtimeMs(workflowResultPath),
    };
  }

  const record = agentRunParsed as AgentRunRecord;
  const wrSpec = record.artifacts.workflowResult;
  const evSpec = record.artifacts.events;
  const wrPathResolved = path.join(runDirReal, wrSpec.relativePath);
  const evPathResolved = path.join(runDirReal, evSpec.relativePath);

  if (!existsSync(wrPathResolved)) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.MISSING_WORKFLOW_RESULT,
        message: `Missing ${WORKFLOW_RESULT_FILENAME} under run folder.`,
        path: wrPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: mtimeMs(eventsPath),
    };
  }

  let wrBuf: Buffer;
  try {
    wrBuf = readFileSync(wrPathResolved);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.MISSING_WORKFLOW_RESULT,
        message: msg,
        path: wrPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved },
      capturedAtEffectiveMs: mtimeMs(wrPathResolved),
    };
  }

  if (wrBuf.length !== wrSpec.byteLength) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.ARTIFACT_LENGTH_MISMATCH,
        message: `${WORKFLOW_RESULT_FILENAME} byte length does not match ${AGENT_RUN_FILENAME}.`,
        path: wrPathResolved,
        details: { expected: wrSpec.byteLength, actual: wrBuf.length },
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: mtimeMs(wrPathResolved),
    };
  }

  if (sha256Hex(wrBuf) !== wrSpec.sha256) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.ARTIFACT_INTEGRITY_MISMATCH,
        message: `${WORKFLOW_RESULT_FILENAME} SHA-256 does not match ${AGENT_RUN_FILENAME}.`,
        path: wrPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: mtimeMs(wrPathResolved),
    };
  }

  if (!existsSync(evPathResolved)) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.MISSING_EVENTS,
        message: `Missing ${EVENTS_FILENAME} under run folder.`,
        path: evPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  let evBuf: Buffer;
  try {
    evBuf = readFileSync(evPathResolved);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.MISSING_EVENTS,
        message: msg,
        path: evPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  if (evBuf.length !== evSpec.byteLength) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.ARTIFACT_LENGTH_MISMATCH,
        message: `${EVENTS_FILENAME} byte length does not match ${AGENT_RUN_FILENAME}.`,
        path: evPathResolved,
        details: { expected: evSpec.byteLength, actual: evBuf.length },
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  if (sha256Hex(evBuf) !== evSpec.sha256) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.ARTIFACT_INTEGRITY_MISMATCH,
        message: `${EVENTS_FILENAME} SHA-256 does not match ${AGENT_RUN_FILENAME}.`,
        path: evPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  let wrParsed: unknown;
  try {
    wrParsed = JSON.parse(wrBuf.toString("utf8")) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.WORKFLOW_RESULT_JSON,
        message: msg,
        path: wrPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      rawPreview: readUtf8Preview(wrPathResolved, 8192),
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  if (isV9RunLevelCodesInconsistent(wrParsed)) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_RUN_LEVEL_CODES_MISMATCH,
        message: WORKFLOW_RESULT_RUN_LEVEL_CODES_MISMATCH_MESSAGE,
        path: wrPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      rawPreview: readUtf8Preview(wrPathResolved, 8192),
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  const wrSchemaVersion = (wrParsed as { schemaVersion?: unknown }).schemaVersion;
  const wrValid =
    wrSchemaVersion === 9 ? validateWorkflowResultV9(wrParsed) : validateWorkflowResult(wrParsed);
  if (!wrValid) {
    const details =
      wrSchemaVersion === 9
        ? (validateWorkflowResultV9.errors ?? [])
        : (validateWorkflowResult.errors ?? []);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.WORKFLOW_RESULT_INVALID,
        message: "workflow-result.json failed workflow-result schema validation.",
        path: wrPathResolved,
        details,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      rawPreview: readUtf8Preview(wrPathResolved, 8192),
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  let workflowResult: WorkflowResult;
  try {
    workflowResult = normalizeToEmittedWorkflowResult(
      wrParsed as import("./types.js").WorkflowEngineResult | WorkflowResult,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.WORKFLOW_RESULT_INVALID,
        message: msg,
        path: wrPathResolved,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      rawPreview: readUtf8Preview(wrPathResolved, 8192),
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  if (record.workflowId !== workflowResult.workflowId) {
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.AGENT_RUN_WORKFLOW_ID_MISMATCH,
        message: `${AGENT_RUN_FILENAME} workflowId does not match workflow-result.json.`,
        path: agentRunPath,
        details: { manifest: record.workflowId, result: workflowResult.workflowId },
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: evPathResolved },
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  let load;
  try {
    load = loadEventsForWorkflow(eventsPath, workflowResult.workflowId);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      return {
        loadStatus: "error",
        runId,
        error: {
          code: DEBUG_CORPUS_CODES.EVENTS_LOAD_FAILED,
          message: e.message,
          path: eventsPath,
          details: { truthLayerCode: e.code },
        },
        pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: eventsPath },
        rawPreview: readUtf8Preview(eventsPath, 8192),
        capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      loadStatus: "error",
      runId,
      error: {
        code: DEBUG_CORPUS_CODES.EVENTS_LOAD_FAILED,
        message: msg,
        path: eventsPath,
      },
      pathsTried: { agentRun: agentRunPath, workflowResult: wrPathResolved, events: eventsPath },
      rawPreview: readUtf8Preview(eventsPath, 8192),
      capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    };
  }

  return {
    loadStatus: "ok",
    runId,
    workflowResult,
    meta: metaFromRecord(record),
    agentRunRecord: record,
    capturedAtEffectiveMs: capturedAtEffectiveMs(record, wrPathResolved),
    paths: { workflowResult: wrPathResolved, events: eventsPath, agentRun: agentRunPath },
    malformedEventLineCount: load.malformedEventLineCount,
  };
}

export function loadAllCorpusRuns(corpusRoot: string): CorpusRunOutcome[] {
  const rootReal = resolveCorpusRootReal(corpusRoot);
  const ids = listCorpusRunIds(rootReal);
  return ids.map((runId) => loadCorpusRun(rootReal, runId));
}

/** Directory containing packaged `debug-ui` (next to this module in dist/). */
export function debugUiDir(): string {
  return path.join(__dirname, "debug-ui");
}
