import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { formatOperationalMessage } from "../failureCatalog.js";
import { formatDistributionFooter } from "../distributionFooter.js";
import { emitVerifyWorkflowCliJsonAndExitByStatus } from "../standardVerifyWorkflowCli.js";
import { TruthLayerError } from "../truthLayerError.js";
import {
  cleanupOutDirFromPath,
  executeBootstrapPack,
  writeBootstrapOperationalFailure,
} from "./executeBootstrapPack.js";
import { parseBootstrapCliArgs, type ParsedBootstrapCli } from "./bootstrapCliArgs.js";

function usageBootstrap(): string {
  return `Usage:
  agentskeptic bootstrap --input <path> (--db <sqlitePath> | --postgres-url <url>) --out <path>

Builds a contract pack (events.ndjson, tools.json, quick-report.json, README.bootstrap.md) from
BootstrapPackInput v1 JSON + read-only SQL, then replays contract verify in-process.

Exit codes:
  0  Quick pass with exports and contract verify complete (stdout: bootstrap result envelope; stderr empty)
  1  contract verify inconsistent (stdout/stderr: same as agentskeptic verify)
  2  Quick not pass / no exports / contract verify incomplete (stderr: JSON envelope for quick-path; else same as verify)
  3  operational failure (stderr: JSON envelope)

  --help, -h  print this message and exit 0

Normative: docs/bootstrap-pack-normative.md`;
}

export type { ParsedBootstrapCli };
export { parseBootstrapCliArgs } from "./bootstrapCliArgs.js";

export async function runBootstrapSubcommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageBootstrap());
    process.exit(0);
  }

  let parsed: ParsedBootstrapCli;
  try {
    parsed = parseBootstrapCliArgs(args);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeBootstrapOperationalFailure(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const outcome = await executeBootstrapPack(parsed);
  if (outcome.kind === "pack_ready") {
    const envelope = {
      schemaVersion: 1,
      kind: "agentskeptic_bootstrap_result",
      workflowId: outcome.workflowId,
      outDir: outcome.outResolved,
      quickVerdict: "pass",
      verifyStatus: "complete",
      exportedToolCount: outcome.exportedToolCount,
    };
    try {
      process.stdout.write(`${JSON.stringify(envelope)}\n`);
    } catch (e) {
      cleanupOutDirFromPath(outcome.outResolved);
      const msg = e instanceof Error ? e.message : String(e);
      writeBootstrapOperationalFailure(
        CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
        formatOperationalMessage(`stdout: ${msg}`),
      );
      process.exit(3);
    }
    process.exit(0);
    return;
  }

  if (outcome.kind === "bootstrap_cli_error") {
    writeBootstrapOperationalFailure(outcome.code, outcome.message);
    process.exit(outcome.exitCode);
    return;
  }

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
}
