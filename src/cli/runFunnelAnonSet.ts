import { fetchWithTimeout } from "../telemetry/fetchWithTimeout.js";
import { AGENTSKEPTIC_CLI_SEMVER, PUBLIC_CANONICAL_SITE_ORIGIN } from "../publicDistribution.generated.js";
import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { cliErrorEnvelope, formatOperationalMessage } from "../failureCatalog.js";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "../telemetry/productActivationHeaders.js";
import { isPersistedConfigUuid, tryPersistFunnelAnonId } from "../telemetry/cliInstallId.js";

const PUBLIC_FUNNEL_ANON_FETCH_TIMEOUT_MS = 400;

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

export type FunnelAnonPullStatus =
  | "ok"
  | "usage"
  | "env_conflict"
  | "http_error"
  | "parse_error"
  | "write_failed";

/**
 * Core implementation for `agentskeptic funnel-anon pull` (shared with tests).
 */
export async function runFunnelAnonPullFromArgvForTests(argv: string[]): Promise<{ status: FunnelAnonPullStatus }> {
  if (argv[0] !== "pull") return { status: "usage" };
  if (process.env.AGENTSKEPTIC_FUNNEL_ANON_ID?.trim()) return { status: "env_conflict" };
  const origin = PUBLIC_CANONICAL_SITE_ORIGIN.replace(/\/$/, "");
  const url = `${origin}/api/public/funnel-anon`;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          [PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER]: PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
          [PRODUCT_ACTIVATION_CLI_VERSION_HEADER]: AGENTSKEPTIC_CLI_SEMVER,
        },
      },
      PUBLIC_FUNNEL_ANON_FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return { status: "http_error" };
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!j || j.schema_version !== 1 || typeof j.funnel_anon_id !== "string") return { status: "parse_error" };
    if (!tryPersistFunnelAnonId(j.funnel_anon_id)) return { status: "write_failed" };
    return { status: "ok" };
  } catch {
    return { status: "http_error" };
  }
}

export function usageFunnelAnon(): string {
  return `Usage:
  agentskeptic funnel-anon pull
  agentskeptic funnel-anon set <uuid>

pull — fetch a new funnel_anon_id from the canonical site and save it to
~/.agentskeptic/config.json for attributed product-activation telemetry.
Requires AGENTSKEPTIC_FUNNEL_ANON_ID to be unset (CI proof mode).

set — persist the browser-issued funnel anonymous id (see docs/funnel-observability.md).

Optional override for operators: set AGENTSKEPTIC_FUNNEL_ANON_ID instead of using disk.

Exit codes:
  0  success
  2  usage, invalid uuid, or pull while AGENTSKEPTIC_FUNNEL_ANON_ID is set
  3  could not write config file or pull network/parse failure

  --help, -h  print this message and exit 0`;
}

/** CLI entry: mutates process exit and stderr. */
export async function runFunnelAnonCliAndExit(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageFunnelAnon());
    process.exit(0);
  }

  if (args[0] === "pull") {
    const r = await runFunnelAnonPullFromArgvForTests(args);
    if (r.status === "ok") {
      process.exit(0);
    }
    if (r.status === "usage") {
      console.error(usageFunnelAnon());
      process.exit(2);
    }
    if (r.status === "env_conflict") {
      console.error(
        cliErrorEnvelope(
          CLI_OPERATIONAL_CODES.CLI_USAGE,
          "funnel-anon pull requires AGENTSKEPTIC_FUNNEL_ANON_ID to be unset so the minted id is persisted from the server response.",
        ),
      );
      process.exit(2);
    }
    writeCliErrorForFunnelAnon(
      CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      formatOperationalMessage(
        "funnel-anon pull failed (network, server response, or could not write ~/.agentskeptic/config.json).",
      ),
    );
    process.exit(3);
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
