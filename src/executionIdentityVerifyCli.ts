/**
 * Compare pinned execution-identity JSON to the bundled dist artifact (`execution-identity verify`).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { deepStrictEqual } from "node:assert";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { cliErrorEnvelope, formatOperationalMessage } from "./failureCatalog.js";
import { CLI_EXITED_AFTER_ERROR } from "./standardVerifyWorkflowCli.js";
import { argValue } from "./cliArgv.js";
import type { StandardVerifyWorkflowCliIo } from "./standardVerifyWorkflowCli.js";
import { npmPackageRootFromHere } from "./verificationReceipt.js";

const defaultIo = {
  consoleLog: (line: string) => {
    process.stdout.write(`${line}\n`);
  },
  stderrLine: (line: string) => {
    process.stderr.write(`${line}\n`);
  },
  exit: (code: number) => process.exit(code),
} satisfies Pick<StandardVerifyWorkflowCliIo, "consoleLog" | "stderrLine" | "exit">;

export function executionIdentityVerifyUsage(): string {
  return `Usage:
  agentskeptic execution-identity verify --expect-json <path>

Compare repo-pinned execution-identity JSON against the bundled dist/artifact (same fields except $schema is ignored).

Exit codes:
  0  pinned JSON matches dist/execution-identity.v1.json
  2  field mismatch (${CLI_OPERATIONAL_CODES.EXECUTION_IDENTITY_MISMATCH})
  3  usage or IO/read failure (${CLI_OPERATIONAL_CODES.EXECUTION_IDENTITY_USAGE} / operational)

  --help, -h  print this message and exit 0`;
}

function stripSchema(obj: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _, ...rest } = obj;
  return rest;
}

/**
 * Operational exits (3): prints JSON stderr envelope via `stderrLine`; verification exits delegate to `io.exit`.
 */
export function runExecutionIdentityVerifyCli(
  argv: string[],
  io: Partial<Pick<StandardVerifyWorkflowCliIo, "consoleLog" | "stderrLine" | "exit">> = {},
): void {
  const out = { ...defaultIo, ...io };
  if (argv.includes("--help") || argv.includes("-h")) {
    out.consoleLog(executionIdentityVerifyUsage());
    out.exit(0);
  }
  if (argv[0] !== "verify") {
    out.stderrLine(
      cliErrorEnvelope(
        CLI_OPERATIONAL_CODES.EXECUTION_IDENTITY_USAGE,
        formatOperationalMessage("Expected subcommand verify."),
      ),
    );
    out.exit(3);
    throw new Error(CLI_EXITED_AFTER_ERROR);
  }
  const expectPathRaw = argValue(argv.slice(1), "--expect-json");
  if (!expectPathRaw?.trim()) {
    out.stderrLine(
      cliErrorEnvelope(
        CLI_OPERATIONAL_CODES.EXECUTION_IDENTITY_USAGE,
        formatOperationalMessage("Missing --expect-json <path>."),
      ),
    );
    out.exit(3);
    throw new Error(CLI_EXITED_AFTER_ERROR);
  }

  const packageRoot = npmPackageRootFromHere(import.meta.url);
  const bundledPath = path.join(packageRoot, "dist", "execution-identity.v1.json");
  const expectAbs = path.resolve(expectPathRaw);
  let bundled: Record<string, unknown>;
  let expectDoc: Record<string, unknown>;
  try {
    bundled = JSON.parse(readFileSync(bundledPath, "utf8")) as Record<string, unknown>;
    expectDoc = JSON.parse(readFileSync(expectAbs, "utf8")) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    out.stderrLine(
      cliErrorEnvelope(
        CLI_OPERATIONAL_CODES.EXECUTION_IDENTITY_USAGE,
        formatOperationalMessage(`Cannot read execution-identity JSON: ${msg}`),
      ),
    );
    out.exit(3);
    throw new Error(CLI_EXITED_AFTER_ERROR);
  }

  try {
    deepStrictEqual(stripSchema(bundled), stripSchema(expectDoc));
  } catch {
    out.stderrLine(
      cliErrorEnvelope(
        CLI_OPERATIONAL_CODES.EXECUTION_IDENTITY_MISMATCH,
        formatOperationalMessage("Pinned execution-identity JSON does not match dist/execution-identity.v1.json."),
      ),
    );
    out.exit(2);
    throw new Error(CLI_EXITED_AFTER_ERROR);
  }
  out.exit(0);
  throw new Error(CLI_EXITED_AFTER_ERROR);
}
