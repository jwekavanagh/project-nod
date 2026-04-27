import { formatDistributionFooter } from "./distributionFooter.js";
import { writeSync } from "node:fs";
import {
  CLI_OPERATIONAL_CODES,
  cliErrorEnvelope,
  formatOperationalMessage,
} from "./failureCatalog.js";
import {
  buildOutcomeCertificateFromWorkflowResult,
  type OutcomeCertificateV1,
} from "./outcomeCertificate.js";
import type { WorkflowResult } from "./types.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { postPublicVerificationReport } from "./shareReport/postPublicVerificationReport.js";
import { TruthLayerError } from "./truthLayerError.js";

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

/** Validates engine `WorkflowResult`, builds public Outcome Certificate v1, validates certificate schema. */
export async function runBatchVerifyToValidatedCertificate(
  runVerify: () => Promise<WorkflowResult>,
): Promise<{ workflowResult: WorkflowResult; certificate: OutcomeCertificateV1 }> {
  const workflowResult = await runBatchVerifyToValidatedResult(runVerify);
  const certificate = buildOutcomeCertificateFromWorkflowResult(workflowResult, "contract_sql");
  const validateCert = loadSchemaValidator("outcome-certificate-v1");
  if (!validateCert(certificate)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      JSON.stringify(validateCert.errors ?? []),
    );
  }
  return { workflowResult, certificate };
}

export type StandardVerifyWorkflowCliIo = {
  consoleLog: (line: string) => void;
  stderrLine: (line: string) => void;
  exit: (code: number) => void;
};

/**
 * Print Outcome Certificate JSON to stdout and exit by `stateRelation` (same thresholds as legacy workflow status).
 */
export function emitOutcomeCertificateCliAndExitByStateRelation(
  certificate: OutcomeCertificateV1,
  io: Pick<StandardVerifyWorkflowCliIo, "consoleLog" | "exit">,
): void {
  io.consoleLog(JSON.stringify(certificate));
  if (certificate.stateRelation === "matches_expectations") io.exit(0);
  if (certificate.stateRelation === "does_not_match") io.exit(1);
  io.exit(2);
}

/** @internal Emit Outcome Certificate to stdout from an already-validated engine result (lock / bootstrap paths). */
export function emitVerifyWorkflowCliJsonAndExitByStatus(
  result: WorkflowResult,
  io: Pick<StandardVerifyWorkflowCliIo, "consoleLog" | "exit">,
): void {
  const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
  emitOutcomeCertificateCliAndExitByStateRelation(certificate, io);
}

const defaultIo: StandardVerifyWorkflowCliIo = {
  consoleLog: (line) => {
    writeSync(1, `${line}\n`);
  },
  stderrLine: (line) => {
    writeSync(2, `${line}\n`);
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
 * Runs verify through bundle/share side effects and returns the terminal Outcome Certificate.
 * On failure, writes CLI error, calls `io.exit(3)`, then throws `CLI_EXITED_AFTER_ERROR` if the process continues.
 */
export async function runStandardVerifyWorkflowCliToTerminalResult(options: {
  runVerify?: () => Promise<WorkflowResult>;
  /** When set, used instead of `runVerify` + default contract certificate builder (e.g. LangGraph checkpoint trust). */
  runVerifyWithCertificate?: () => Promise<{
    workflowResult: WorkflowResult;
    certificate: OutcomeCertificateV1;
  }>;
  maybeWriteBundle?: (result: WorkflowResult) => void;
  /** When set, human stderr is deferred until after a successful POST to this origin. */
  shareReportOrigin?: string;
  io?: Partial<StandardVerifyWorkflowCliIo>;
}): Promise<{ certificate: OutcomeCertificateV1; workflowResult: WorkflowResult }> {
  const io = { ...defaultIo, ...options.io };
  const writeCliError = (code: string, message: string): void => {
    io.stderrLine(cliErrorEnvelope(code, message));
  };

  let certificate: OutcomeCertificateV1;
  let workflowResult: WorkflowResult;
  try {
    if (options.runVerifyWithCertificate) {
      const pair = await options.runVerifyWithCertificate();
      workflowResult = pair.workflowResult;
      certificate = pair.certificate;
      const validateWf = loadSchemaValidator("workflow-result");
      if (!validateWf(workflowResult)) {
        throw new TruthLayerError(
          CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
          JSON.stringify(validateWf.errors ?? []),
        );
      }
      const validateCert = loadSchemaValidator("outcome-certificate-v1");
      if (!validateCert(certificate)) {
        throw new TruthLayerError(
          CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
          JSON.stringify(validateCert.errors ?? []),
        );
      }
    } else if (options.runVerify) {
      const pair = await runBatchVerifyToValidatedCertificate(options.runVerify);
      workflowResult = pair.workflowResult;
      certificate = pair.certificate;
    } else {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
        formatOperationalMessage("runStandardVerifyWorkflowCliToTerminalResult: missing runVerify"),
      );
    }
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
      options.maybeWriteBundle(workflowResult);
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
    const shareRes = await postPublicVerificationReport(origin, {
      schemaVersion: 2,
      certificate,
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
    io.stderrLine(`${certificate.humanReport}\n${formatDistributionFooter()}`);
  }

  return { certificate, workflowResult };
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
    const { certificate } = await runStandardVerifyWorkflowCliToTerminalResult({ ...options, io });
    emitOutcomeCertificateCliAndExitByStateRelation(certificate, io);
  } catch (e) {
    if (e instanceof Error && e.message === CLI_EXITED_AFTER_ERROR) return;
    throw e;
  }
}
