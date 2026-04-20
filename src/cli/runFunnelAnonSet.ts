import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { cliErrorEnvelope, formatOperationalMessage } from "../failureCatalog.js";
import { isPersistedConfigUuid, tryPersistFunnelAnonId } from "../telemetry/cliInstallId.js";

export type FunnelAnonSetStatus = "ok" | "usage" | "invalid_uuid" | "write_failed";

/**
 * Core implementation for `agentskeptic funnel-anon set <uuid>` (shared with tests).
 */
export function runFunnelAnonSetFromArgvForTests(argv: string[]): { status: FunnelAnonSetStatus } {
  if (argv[0] !== "set" || argv.length < 2) return { status: "usage" };
  const uuid = argv[1]!;
  if (!isPersistedConfigUuid(uuid)) return { status: "invalid_uuid" };
  if (!tryPersistFunnelAnonId(uuid)) return { status: "write_failed" };
  return { status: "ok" };
}

export function usageFunnelAnon(): string {
  return `Usage:
  agentskeptic funnel-anon set <uuid>

Persist the browser-issued funnel anonymous id to ~/.agentskeptic/config.json for
attributed product-activation telemetry (see docs/funnel-observability-ssot.md).

The uuid must match the site beacon id (localStorage agentskeptic_funnel_anon_id on agentskeptic.com).

Optional override for operators/CI: set AGENTSKEPTIC_FUNNEL_ANON_ID instead of using this command.

Exit codes:
  0  success
  2  usage or invalid uuid (stderr: JSON envelope for invalid uuid)
  3  could not write config file (stderr: JSON envelope)

  --help, -h  print this message and exit 0`;
}

/** CLI entry: mutates process exit and stderr. */
export function runFunnelAnonCliAndExit(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageFunnelAnon());
    process.exit(0);
  }
  const r = runFunnelAnonSetFromArgvForTests(args);
  if (r.status === "ok") {
    console.log(args[1]!.trim());
    process.exit(0);
  }
  if (r.status === "usage") {
    console.error(usageFunnelAnon());
    process.exit(2);
  }
  if (r.status === "invalid_uuid") {
    writeCliErrorForFunnelAnon(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "funnel-anon set requires a valid UUID (browser-issued funnel_anon_id).",
    );
    process.exit(2);
  }
  writeCliErrorForFunnelAnon(
    CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
    formatOperationalMessage("Could not write ~/.agentskeptic/config.json"),
  );
  process.exit(3);
}

function writeCliErrorForFunnelAnon(code: string, message: string): void {
  console.error(cliErrorEnvelope(code, message));
}
