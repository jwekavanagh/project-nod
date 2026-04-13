import { formatDistributionFooter } from "./distributionFooter.js";
import {
  CLI_OPERATIONAL_CODES,
  cliErrorEnvelope,
  formatOperationalMessage,
} from "./failureCatalog.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { postPublicVerificationReport } from "./shareReport/postPublicVerificationReport.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { WorkflowResult } from "./types.js";
import { formatWorkflowTruthReportStruct } from "./workflowTruthReport.js";

/**
 * Run batch verification and validate emitted WorkflowResult against schema.
 * @throws TruthLayerError WORKFLOW_RESULT_SCHEMA_INVALID on invalid shape
 * @throws whatever `runVerify` throws (e.g. TruthLayerError from pipeline)
 */
export async function runBatchVerifyToValidatedResult(
  runVerify: () => Promise<WorkflowResult>,
): Promise<WorkflowResult> {
  const result = await runVerify();
  const validateResult = loadSchemaValidator("workflow-result");
  if (!validateResult(result)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      JSON.stringify(validateResult.errors ?? []),
    );
  }
  return result;
}

export type StandardVerifyWorkflowCliIo = {
  consoleLog: (line: string) => void;
  stderrLine: (line: string) => void;
  exit: (code: number) => void;
};

/**
 * After `verifyWorkflow` has emitted the human truth report to stderr (unless suppressed),
 * print WorkflowResult JSON to stdout and exit with the same codes as batch `verify`.
 */
export function emitVerifyWorkflowCliJsonAndExitByStatus(
  result: WorkflowResult,
  io: Pick<StandardVerifyWorkflowCliIo, "consoleLog" | "exit">,
): void {
  io.consoleLog(JSON.stringify(result));
  if (result.status === "complete") io.exit(0);
  else if (result.status === "inconsistent") io.exit(1);
  else io.exit(2);
}

const defaultIo: StandardVerifyWorkflowCliIo = {
  consoleLog: (line) => {
    console.log(line);
  },
  stderrLine: (line) => {
    console.error(line);
  },
  exit: (code) => {
    process.exit(code);
  },
};

/** Thrown after `io.exit(3)` when the process is still alive (e.g. tests mock `exit`). */
export const CLI_EXITED_AFTER_ERROR = "agentskeptic_cli_exited_after_error";

function abortVerifyCli(
  io: StandardVerifyWorkflowCliIo,
  writeCliError: (code: string, message: string) => void,
  code: string,
  message: string,
): never {
  writeCliError(code, message);
  io.exit(3);
  throw new Error(CLI_EXITED_AFTER_ERROR);
}

/**
 * Runs verify through bundle/share side effects and returns the terminal WorkflowResult.
 * On failure, writes CLI error, calls `io.exit(3)`, then throws `CLI_EXITED_AFTER_ERROR` if the process continues.
 */
export async function runStandardVerifyWorkflowCliToTerminalResult(options: {
  runVerify: () => Promise<WorkflowResult>;
  maybeWriteBundle?: (result: WorkflowResult) => void;
  /** When set, human stderr is deferred until after a successful POST to this origin. */
  shareReportOrigin?: string;
  io?: Partial<StandardVerifyWorkflowCliIo>;
}): Promise<WorkflowResult> {
  const io = { ...defaultIo, ...options.io };
  const writeCliError = (code: string, message: string): void => {
    io.stderrLine(cliErrorEnvelope(code, message));
  };

  let result: WorkflowResult;
  try {
    result = await runBatchVerifyToValidatedResult(options.runVerify);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      abortVerifyCli(io, writeCliError, e.code, e.message);
    }
    const msg = e instanceof Error ? e.message : String(e);
    abortVerifyCli(
      io,
      writeCliError,
      CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      formatOperationalMessage(msg),
    );
  }

  if (options.maybeWriteBundle !== undefined) {
    try {
      options.maybeWriteBundle(result);
    } catch (e) {
      if (e instanceof TruthLayerError) {
        abortVerifyCli(io, writeCliError, e.code, e.message);
      }
      const msg = e instanceof Error ? e.message : String(e);
      abortVerifyCli(
        io,
        writeCliError,
        CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
        formatOperationalMessage(msg),
      );
    }
  }

  const origin = options.shareReportOrigin;
  if (origin !== undefined) {
    const truthReportText = formatWorkflowTruthReportStruct(result.workflowTruthReport);
    const shareRes = await postPublicVerificationReport(origin, {
      schemaVersion: 1,
      kind: "workflow",
      workflowResult: result,
      truthReportText,
    });
    if (!shareRes.ok) {
      abortVerifyCli(
        io,
        writeCliError,
        CLI_OPERATIONAL_CODES.SHARE_REPORT_FAILED,
        formatOperationalMessage(
          `share_report_origin=${origin} http_status=${String(shareRes.status)} detail=${shareRes.bodySnippet}`,
        ),
      );
    }
    io.stderrLine(`${truthReportText}\n${formatDistributionFooter()}`);
  }

  return result;
}

/**
 * Shared agentskeptic stdout path: run verification, validate emitted result, optional bundle write, print JSON, exit by verdict.
 * CLI delegates here so tests can inject `runVerify` (e.g. mock `verifyWorkflow`) and I/O without executing `cli.ts` top-level `main()`.
 */
export async function runStandardVerifyWorkflowCliFlow(options: {
  runVerify: () => Promise<WorkflowResult>;
  maybeWriteBundle?: (result: WorkflowResult) => void;
  /** When set, human stderr is deferred until after a successful POST to this origin. */
  shareReportOrigin?: string;
  io?: Partial<StandardVerifyWorkflowCliIo>;
}): Promise<void> {
  const io = { ...defaultIo, ...options.io };
  try {
    const result = await runStandardVerifyWorkflowCliToTerminalResult({ ...options, io });
    emitVerifyWorkflowCliJsonAndExitByStatus(result, io);
  } catch (e) {
    if (e instanceof Error && e.message === CLI_EXITED_AFTER_ERROR) return;
    throw e;
  }
}
