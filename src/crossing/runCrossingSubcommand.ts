import path from "node:path";
import { argValue } from "../cliArgv.js";
import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import {
  cliErrorEnvelope,
  formatOperationalMessage,
} from "../failureCatalog.js";
import { TruthLayerError } from "../truthLayerError.js";
import { parseBootstrapCliArgs } from "../bootstrap/bootstrapCliArgs.js";
import {
  cleanupOutDirFromPath,
  executeBootstrapPack,
  writeBootstrapOperationalFailure,
} from "../bootstrap/executeBootstrapPack.js";
import { formatDistributionFooter } from "../distributionFooter.js";
import { emitVerifyWorkflowCliJsonAndExitByStatus } from "../standardVerifyWorkflowCli.js";
import { runBatchVerifyWithTelemetrySubcommand } from "../verify/batchVerifyTelemetrySubcommand.js";
import { CROSSING_DECISION_READY_FOOTER } from "./crossingDecisionReadyFooter.js";
import type { WorkflowResult } from "../types.js";

function usageCrossing(): string {
  return `Usage:
  agentskeptic crossing --bootstrap-input <path> --pack-out <path> (--db <sqlitePath> | --postgres-url <url>) [--no-truth-report]
  agentskeptic crossing --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>) [--no-truth-report]

Normative: docs/crossing-normative.md

  --help, -h  print this message and exit 0`;
}

function writeCrossingUsageAndExit(message: string): never {
  console.error(cliErrorEnvelope(CLI_OPERATIONAL_CODES.CROSSING_USAGE, formatOperationalMessage(message)));
  process.exit(3);
  throw new Error("unreachable");
}

function assertNoLockFlags(args: string[]): void {
  if (args.includes("--output-lock") || args.includes("--expect-lock")) {
    writeCrossingUsageAndExit("crossing does not support --output-lock or --expect-lock.");
  }
}

const BOOTSTRAP_LED_FLAGS = new Set([
  "--bootstrap-input",
  "--pack-out",
  "--db",
  "--postgres-url",
  "--no-truth-report",
  "--help",
  "-h",
]);

function assertBootstrapLedCrossingArgsOnly(args: string[]): void {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-h" || a === "--help" || a === "--no-truth-report") continue;
    if (!a.startsWith("--")) {
      writeCrossingUsageAndExit(`Unexpected argument: ${a}`);
    }
    if (!BOOTSTRAP_LED_FLAGS.has(a)) {
      writeCrossingUsageAndExit(`Unknown option for bootstrap-led crossing: ${a}`);
    }
    if (a === "--bootstrap-input" || a === "--pack-out" || a === "--db" || a === "--postgres-url") {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) {
        writeCrossingUsageAndExit(`Missing value after ${a}.`);
      }
      i++;
    }
  }
}

function isBootstrapLedMode(args: string[]): boolean {
  return args.includes("--bootstrap-input") || args.includes("--pack-out");
}

function buildVerifyIntegratorOwnedReplayLine(opts: {
  workflowId: string;
  eventsPath: string;
  registryPath: string;
  dbPath?: string;
  postgresUrl?: string;
  noTruthReport: boolean;
}): string {
  const ev = path.resolve(opts.eventsPath);
  const reg = path.resolve(opts.registryPath);
  const dbPart =
    opts.postgresUrl !== undefined ?
      `--postgres-url ${JSON.stringify(opts.postgresUrl)}`
    : `--db ${JSON.stringify(opts.dbPath!)}`;
  const ntr = opts.noTruthReport ? " --no-truth-report" : "";
  return `agentskeptic verify-integrator-owned --workflow-id ${JSON.stringify(opts.workflowId)} --events ${JSON.stringify(ev)} --registry ${JSON.stringify(reg)} ${dbPart}${ntr}`;
}

export async function runCrossingSubcommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageCrossing());
    process.exit(0);
  }

  assertNoLockFlags(args);

  const noTruthReport = args.includes("--no-truth-report");
  const bootstrapLed = isBootstrapLedMode(args);

  if (bootstrapLed) {
    assertBootstrapLedCrossingArgsOnly(args);
    const bi = argValue(args, "--bootstrap-input");
    const po = argValue(args, "--pack-out");
    const db = argValue(args, "--db");
    const pu = argValue(args, "--postgres-url");
    if (!bi || !po) {
      writeCrossingUsageAndExit("bootstrap-led crossing requires --bootstrap-input and --pack-out.");
    }
    if (argValue(args, "--workflow-id") || argValue(args, "--events") || argValue(args, "--registry")) {
      writeCrossingUsageAndExit("bootstrap-led crossing must not pass --workflow-id, --events, or --registry.");
    }
    const dbCount = (db ? 1 : 0) + (pu ? 1 : 0);
    if (dbCount !== 1) {
      writeCrossingUsageAndExit("Provide exactly one of --db or --postgres-url.");
    }

    let parsed;
    try {
      parsed = parseBootstrapCliArgs(["--input", bi, "--out", po, ...(db ? ["--db", db] : ["--postgres-url", pu!])]);
    } catch (e) {
      if (e instanceof TruthLayerError) {
        writeCrossingUsageAndExit(e.message);
      }
      throw e;
    }

    const outcome = await executeBootstrapPack(parsed);
    if (outcome.kind === "bootstrap_cli_error") {
      writeBootstrapOperationalFailure(outcome.code, outcome.message);
      process.exit(outcome.exitCode);
    }
    if (outcome.kind === "verify_terminal") {
      process.stderr.write(`${outcome.truthBuffered}\n`);
      process.stderr.write(formatDistributionFooter());
      const exitWithCleanup = (code: number): void => {
        cleanupOutDirFromPath(outcome.outResolved);
        process.exit(code);
      };
      emitVerifyWorkflowCliJsonAndExitByStatus(outcome.result, {
        consoleLog: (line) => {
          console.log(line);
        },
        exit: exitWithCleanup,
      });
      return;
    }

    const packOutAbs = path.resolve(outcome.outResolved);
    const batchArgs = [
      "--workflow-id",
      outcome.workflowId,
      "--events",
      outcome.eventsPath,
      "--registry",
      outcome.registryPath,
      ...(db ? ["--db", path.resolve(db)] : ["--postgres-url", pu!]),
      ...(noTruthReport ? ["--no-truth-report"] : []),
    ];

    await runBatchVerifyWithTelemetrySubcommand(batchArgs, {
      telemetrySubcommand: "verify_integrator_owned",
      rejectBundled: true,
      stderrAppendBeforeStdout: (result: WorkflowResult) => {
        if (result.status !== "complete") {
          process.stderr.write(`agentskeptic-crossing: pack-out retained at ${packOutAbs}\n`);
          process.stderr.write(
            `Re-run phase 2: ${buildVerifyIntegratorOwnedReplayLine({
              workflowId: outcome.workflowId,
              eventsPath: outcome.eventsPath,
              registryPath: outcome.registryPath,
              dbPath: db ? path.resolve(db) : undefined,
              postgresUrl: pu ?? undefined,
              noTruthReport,
            })}\n`,
          );
        }
        process.stderr.write(CROSSING_DECISION_READY_FOOTER);
      },
    });
    return;
  }

  const wf = argValue(args, "--workflow-id");
  const ev = argValue(args, "--events");
  const reg = argValue(args, "--registry");
  const db = argValue(args, "--db");
  const pu = argValue(args, "--postgres-url");
  if (!wf || !ev || !reg) {
    writeCrossingUsageAndExit("pack-led crossing requires --workflow-id, --events, and --registry.");
  }
  const dbCount = (db ? 1 : 0) + (pu ? 1 : 0);
  if (dbCount !== 1) {
    writeCrossingUsageAndExit("Provide exactly one of --db or --postgres-url.");
  }

  await runBatchVerifyWithTelemetrySubcommand(args, {
    telemetrySubcommand: "verify_integrator_owned",
    rejectBundled: true,
    stderrAppendBeforeStdout: (_result: WorkflowResult) => {
      process.stderr.write(CROSSING_DECISION_READY_FOOTER);
    },
  });
}
