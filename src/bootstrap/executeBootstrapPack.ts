import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { runLicensePreflightIfNeeded } from "../commercial/licensePreflight.js";
import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import {
  cliErrorEnvelope,
  formatOperationalMessage,
} from "../failureCatalog.js";
import { verifyWorkflow } from "../pipeline.js";
import { loadSchemaValidator } from "../schemaLoad.js";
import { TruthLayerError } from "../truthLayerError.js";
import type { VerificationDatabase } from "../types.js";
import type { WorkflowResult } from "../types.js";
import { formatDistributionFooter } from "../distributionFooter.js";
import { atomicWriteUtf8File } from "../quickVerify/atomicWrite.js";
import { buildQuickContractEventsNdjson } from "../quickVerify/buildQuickContractEventsNdjson.js";
import { stableStringify } from "../quickVerify/canonicalJson.js";
import { runQuickVerifyToValidatedReport } from "../quickVerify/runQuickVerify.js";
import { buildBootstrapReadmeMarkdown } from "./bootstrapReadmeTemplate.js";
import { parseBootstrapPackInputJson } from "./parseBootstrapPackInput.js";
import { synthesizeQuickInputUtf8FromOpenAiV1 } from "./synthesizeQuickInputFromOpenAiV1.js";
import type { ParsedBootstrapCli } from "./bootstrapCliArgs.js";

export function cleanupOutDirFromPath(outResolved: string): void {
  try {
    rmSync(outResolved, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

export type ExecuteBootstrapPackSuccess = {
  kind: "pack_ready";
  workflowId: string;
  eventsPath: string;
  registryPath: string;
  outResolved: string;
  exportedToolCount: number;
};

export type ExecuteBootstrapPackFailure =
  | { kind: "bootstrap_cli_error"; exitCode: 2 | 3; code: string; message: string }
  | {
      kind: "verify_terminal";
      exitCode: 1 | 2;
      result: WorkflowResult;
      truthBuffered: string;
      outResolved: string;
    };

/**
 * Core bootstrap pack build + in-process contract verify.
 * On success (`pack_ready`), leaves `outResolved` on disk.
 * On `verify_terminal`, leaves `outResolved` on disk until the caller exits (caller must cleanup via exit hook).
 * On `operational`, cleans up `outResolved` when it was created.
 */
export async function executeBootstrapPack(
  parsed: ParsedBootstrapCli,
): Promise<ExecuteBootstrapPackSuccess | ExecuteBootstrapPackFailure> {
  const outResolved = path.resolve(parsed.outPath);
  if (existsSync(outResolved)) {
    return {
      kind: "bootstrap_cli_error",
      exitCode: 3,
      code: CLI_OPERATIONAL_CODES.BOOTSTRAP_OUT_EXISTS,
      message: `--out already exists: ${outResolved}`,
    };
  }

  let rawInput: string;
  try {
    rawInput = readFileSync(path.resolve(parsed.inputPath), "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 3,
      code: CLI_OPERATIONAL_CODES.BOOTSTRAP_USAGE,
      message: `Cannot read --input: ${msg}`,
    };
  }

  let packInput: ReturnType<typeof parseBootstrapPackInputJson>;
  try {
    packInput = parseBootstrapPackInputJson(rawInput);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      return { kind: "bootstrap_cli_error", exitCode: 3, code: e.code, message: e.message };
    }
    throw e;
  }

  try {
    await runLicensePreflightIfNeeded("verify");
  } catch (e) {
    if (e instanceof TruthLayerError) {
      return { kind: "bootstrap_cli_error", exitCode: 3, code: e.code, message: e.message };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 3,
      code: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      message: formatOperationalMessage(msg),
    };
  }

  mkdirSync(outResolved, { recursive: false });

  const database: VerificationDatabase = parsed.postgresUrl
    ? { kind: "postgres", connectionString: parsed.postgresUrl }
    : { kind: "sqlite", path: path.resolve(parsed.dbPath!) };

  const inputUtf8 = synthesizeQuickInputUtf8FromOpenAiV1(packInput);

  let report: Awaited<ReturnType<typeof runQuickVerifyToValidatedReport>>["report"];
  let registryUtf8: string;
  let contractExports: Awaited<ReturnType<typeof runQuickVerifyToValidatedReport>>["contractExports"];
  try {
    const out = await runQuickVerifyToValidatedReport({
      inputUtf8,
      postgresUrl: parsed.postgresUrl ?? undefined,
      sqlitePath: parsed.dbPath !== undefined ? path.resolve(parsed.dbPath) : undefined,
    });
    report = out.report;
    registryUtf8 = out.registryUtf8;
    contractExports = out.contractExports;
  } catch (e) {
    cleanupOutDirFromPath(outResolved);
    if (e instanceof TruthLayerError) {
      return { kind: "bootstrap_cli_error", exitCode: 3, code: e.code, message: e.message };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 3,
      code: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      message: formatOperationalMessage(msg),
    };
  }

  if (report.verdict !== "pass") {
    cleanupOutDirFromPath(outResolved);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 2,
      code: CLI_OPERATIONAL_CODES.BOOTSTRAP_QUICK_NOT_PASS,
      message: `Quick Verify verdict was "${report.verdict}" (expected pass).`,
    };
  }
  if (contractExports.length === 0) {
    cleanupOutDirFromPath(outResolved);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 2,
      code: CLI_OPERATIONAL_CODES.BOOTSTRAP_NO_EXPORTABLE_TOOLS,
      message: "Quick Verify produced zero exportable tools for contract replay.",
    };
  }

  const eventsPath = path.join(outResolved, "events.ndjson");
  const toolsPath = path.join(outResolved, "tools.json");
  const quickReportPath = path.join(outResolved, "quick-report.json");
  const readmePath = path.join(outResolved, "README.bootstrap.md");

  try {
    atomicWriteUtf8File(toolsPath, registryUtf8);
    atomicWriteUtf8File(
      eventsPath,
      buildQuickContractEventsNdjson({
        workflowId: packInput.workflowId,
        exports: contractExports,
      }),
    );
    atomicWriteUtf8File(quickReportPath, `${stableStringify(report)}\n`);
    atomicWriteUtf8File(readmePath, buildBootstrapReadmeMarkdown(packInput.workflowId));
  } catch (e) {
    cleanupOutDirFromPath(outResolved);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 3,
      code: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      message: formatOperationalMessage(`pack write: ${msg}`),
    };
  }

  let truthBuffered = "";
  let result: WorkflowResult;
  try {
    result = await verifyWorkflow({
      workflowId: packInput.workflowId,
      eventsPath,
      registryPath: toolsPath,
      database,
      truthReport: (r) => {
        truthBuffered = r;
      },
    });
  } catch (e) {
    cleanupOutDirFromPath(outResolved);
    if (e instanceof TruthLayerError) {
      return { kind: "bootstrap_cli_error", exitCode: 3, code: e.code, message: e.message };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 3,
      code: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      message: formatOperationalMessage(msg),
    };
  }

  const validateResult = loadSchemaValidator("workflow-result");
  if (!validateResult(result)) {
    cleanupOutDirFromPath(outResolved);
    return {
      kind: "bootstrap_cli_error",
      exitCode: 3,
      code: CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      message: JSON.stringify(validateResult.errors ?? []),
    };
  }

  if (result.status === "complete") {
    return {
      kind: "pack_ready",
      workflowId: packInput.workflowId,
      eventsPath,
      registryPath: toolsPath,
      outResolved,
      exportedToolCount: contractExports.length,
    };
  }

  const exitCode: 1 | 2 = result.status === "inconsistent" ? 1 : 2;
  return {
    kind: "verify_terminal",
    exitCode,
    result,
    truthBuffered,
    outResolved,
  };
}

export function writeBootstrapOperationalFailure(code: string, message: string): void {
  console.error(cliErrorEnvelope(code, formatOperationalMessage(message)));
}
