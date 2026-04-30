import {
  CLI_OPERATIONAL_CODES,
  cliErrorEnvelope,
  formatOperationalMessage,
} from "./failureCatalog.js";
import { TruthLayerError } from "./truthLayerError.js";
import { LICENSE_PREFLIGHT_ENABLED } from "./generated/commercialBuildFlags.js";
import { exitAfterEnforceCliReceipt } from "./cliExecutionFinalize.js";
import { runStatefulEnforce } from "./enforceStateful.js";

/** User-facing message for OSS builds when `enforce` is invoked; exported for tests. */
export const ENFORCE_OSS_GATE_MESSAGE =
  "The OSS build cannot run agentskeptic enforce (CI lock gating). Install the published npm package agentskeptic, set AGENTSKEPTIC_API_KEY (legacy WORKFLOW_VERIFIER_API_KEY accepted), and point COMMERCIAL_LICENSE_API_BASE_URL at your license server; or run npm run build:commercial with COMMERCIAL_LICENSE_API_BASE_URL set. Policy: docs/commercial-enforce-gate-normative.md";

function writeCliError(code: string, message: string): void {
  console.error(cliErrorEnvelope(code, message));
}

function usageEnforce(): string {
  return `Usage:
  agentskeptic enforce --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>)
    [--create-baseline | --accept-drift] [other batch verify flags]

Stateful model:
  default: compare current run to accepted baseline (paid, over-time).
  --create-baseline: initialize or replace accepted baseline.
  --accept-drift: accept current drift as new baseline.

Exit codes: same as batch verify for 0–2; 3 operational; 4 drift.

See docs/ci-enforcement.md and docs/agentskeptic.md.

  --help, -h  print this message and exit 0`;
}

export async function runEnforce(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageEnforce());
    process.exit(0);
  }
  if (!LICENSE_PREFLIGHT_ENABLED) {
    writeCliError(CLI_OPERATIONAL_CODES.ENFORCE_REQUIRES_COMMERCIAL_BUILD, ENFORCE_OSS_GATE_MESSAGE);
    exitAfterEnforceCliReceipt({
      parsedBatch: null,
      quick: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.ENFORCE_REQUIRES_COMMERCIAL_BUILD,
      certificate: null,
    });
  }
  try {
    await runStatefulEnforce(args);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      exitAfterEnforceCliReceipt({
        parsedBatch: null,
        quick: null,
        exitCode: 3,
        operationalCode: e.code,
        certificate: null,
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    exitAfterEnforceCliReceipt({
      parsedBatch: null,
      quick: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      certificate: null,
    });
  }
}
