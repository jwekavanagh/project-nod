import path from "node:path";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { VerificationDatabase, VerificationPolicy } from "./types.js";
import { parseVerificationDatabaseUrl } from "./verificationDatabaseUrl.js";
import { resolveVerificationPolicyInput } from "./verificationPolicy.js";

export function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

export function argValues(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name) {
      if (i + 1 >= args.length) break;
      out.push(args[i + 1]!);
      i++;
    }
  }
  return out;
}

/**
 * Parses `--share-report-origin` when present: https URL, origin only (no path/query/fragment).
 * @throws TruthLayerError CLI_USAGE
 */
export function parseOptionalShareReportOrigin(args: string[]): string | undefined {
  const raw = argValue(args, "--share-report-origin");
  if (raw === undefined) return undefined;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new TruthLayerError(CLI_OPERATIONAL_CODES.CLI_USAGE, "Invalid --share-report-origin URL.");
  }
  if (u.protocol !== "https:") {
    throw new TruthLayerError(CLI_OPERATIONAL_CODES.CLI_USAGE, "--share-report-origin must use https://.");
  }
  if (u.username || u.password) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "--share-report-origin must not include userinfo.",
    );
  }
  if (u.pathname !== "/" || u.search !== "" || u.hash !== "") {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "--share-report-origin must be an origin only (no path, query, or fragment).",
    );
  }
  return u.origin;
}

export function removeArgPair(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      i += 1;
      continue;
    }
    out.push(args[i]!);
  }
  return out;
}

function verificationPolicyFromCliArgs(args: string[]): VerificationPolicy {
  const mode = argValue(args, "--consistency") ?? "strong";
  if (mode !== "strong" && mode !== "eventual") {
    throw new TruthLayerError(CLI_OPERATIONAL_CODES.CLI_USAGE, "Invalid --consistency; use strong or eventual.");
  }
  const windowRaw = argValue(args, "--verification-window-ms");
  const pollRaw = argValue(args, "--poll-interval-ms");
  if (mode === "strong") {
    if (windowRaw !== undefined || pollRaw !== undefined) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.CLI_USAGE,
        "strong consistency does not accept --verification-window-ms or --poll-interval-ms.",
      );
    }
    return resolveVerificationPolicyInput({ consistencyMode: "strong", verificationWindowMs: 0, pollIntervalMs: 0 });
  }
  if (windowRaw === undefined || pollRaw === undefined) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "eventual consistency requires --verification-window-ms and --poll-interval-ms.",
    );
  }
  const verificationWindowMs = Number(windowRaw);
  const pollIntervalMs = Number(pollRaw);
  return resolveVerificationPolicyInput({
    consistencyMode: "eventual",
    verificationWindowMs,
    pollIntervalMs,
  });
}

export type ParsedBatchVerifyCli = {
  workflowId: string;
  eventsPath: string;
  registryPath: string;
  database: VerificationDatabase;
  verificationPolicy: VerificationPolicy;
  noHumanReport: boolean;
  writeRunBundleDir: string | undefined;
  signPrivateKeyPath: string | undefined;
  shareReportOrigin: string | undefined;
  /** When true, batch verify emits the LangGraph checkpoint trust Outcome Certificate contract (v3 wire only). */
  langgraphCheckpointTrust: boolean;
  writeDecisionBundleDir: string | undefined;
  decisionAttestationPath: string | undefined;
  decisionNextActionPath: string | undefined;
  /** When true, stderr includes truth_check_verdict for primary product path (agentskeptic check). */
  invokedViaCheck?: boolean;
  /** Absolute resolved --project root when present. */
  projectPath?: string;
  /** Explicit --coverage-budget path (may be relative to cwd). */
  coverageBudgetPathArg?: string;
  /** When true, fail exit 1 on budget miss if state exit would be 0 (requires active budget policy). */
  enforceCoverageBudget?: boolean;
};

/**
 * Parse argv for bare `agentskeptic` batch mode (no subcommand).
 * @throws TruthLayerError CLI_USAGE
 */
export function parseBatchVerifyCliArgs(args: string[]): ParsedBatchVerifyCli {
  const workflowId = argValue(args, "--workflow-id");
  const eventsPath = argValue(args, "--events");
  const registryPath = argValue(args, "--registry");
  const dbPath = argValue(args, "--db");
  const postgresUrl = argValue(args, "--postgres-url");

  if (!workflowId || !eventsPath || !registryPath) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "Missing --workflow-id, --events, or --registry.",
    );
  }

  const dbCount = (dbPath ? 1 : 0) + (postgresUrl ? 1 : 0);
  if (dbCount !== 1) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "Provide exactly one of --db or --postgres-url.",
    );
  }

  const verificationPolicy = verificationPolicyFromCliArgs(args);
  const noHumanReport = args.includes("--no-human-report");
  const langgraphCheckpointTrust = args.includes("--langgraph-checkpoint-trust");
  const writeRunBundleDir = argValue(args, "--write-run-bundle");
  const signPrivateKeyPath = argValue(args, "--sign-ed25519-private-key");
  if (signPrivateKeyPath !== undefined && writeRunBundleDir === undefined) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "--sign-ed25519-private-key requires --write-run-bundle.",
    );
  }

  const proofDir = argValue(args, "--proof");
  const writeDecisionBundleDir = argValue(args, "--write-decision-bundle") ?? proofDir;
  const decisionAttestationPath = argValue(args, "--decision-attestation");
  const decisionNextActionPath = argValue(args, "--decision-next-action");

  const projectRoot = process.cwd();
  const projectRaw = argValue(args, "--project");
  const projectPath =
    projectRaw !== undefined && projectRaw.length > 0 ? path.resolve(projectRoot, projectRaw) : undefined;
  const coverageBudgetPathArg = argValue(args, "--coverage-budget");
  const enforceCoverageBudget = args.includes("--enforce-coverage-budget");

  return {
    workflowId,
    eventsPath,
    registryPath,
    database: postgresUrl
      ? parseVerificationDatabaseUrl(postgresUrl, projectRoot)
      : parseVerificationDatabaseUrl(dbPath!, projectRoot),
    verificationPolicy,
    noHumanReport,
    writeRunBundleDir,
    signPrivateKeyPath,
    shareReportOrigin: parseOptionalShareReportOrigin(args),
    langgraphCheckpointTrust,
    writeDecisionBundleDir,
    decisionAttestationPath,
    decisionNextActionPath,
    invokedViaCheck: args.includes("--internal-invoked-via-check"),
    ...(projectPath !== undefined ? { projectPath } : {}),
    ...(coverageBudgetPathArg !== undefined && coverageBudgetPathArg.length > 0 ?
      { coverageBudgetPathArg }
    : {}),
    ...(enforceCoverageBudget ? { enforceCoverageBudget: true } : {}),
  };
}

/**
 * Injects `--registry` / `--events` defaults beside `--project` (same semantics as primary `agentskeptic check` help).
 * Used by batch `enforce`, `agentskeptic check`, and any adapter that parses via `parseBatchVerifyCliArgs` after injection.
 * @throws TruthLayerError CLI_USAGE when `--project` is present without `--workflow-id`
 */
export function prepareBatchVerifyArgvForProjectDefaults(argv: string[]): string[] {
  const out = [...argv];
  const projectRaw = argValue(out, "--project");
  if (projectRaw === undefined) return out;
  const wf = argValue(out, "--workflow-id");
  if (!wf) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "--workflow-id is required with --project (workflow id is never inferred).",
    );
  }
  const projectAbs = path.resolve(projectRaw);
  if (!argValue(out, "--registry")) {
    out.push("--registry", path.join(projectAbs, "agentskeptic", "tools.json"));
  }
  if (!argValue(out, "--events")) {
    out.push("--events", path.join(projectAbs, "agentskeptic", "events.ndjson"));
  }
  return out;
}

/**
 * Expand `agentskeptic check` argv into batch-verify argv (no `check` token).
 * Maps `--proof <dir>` → `--write-decision-bundle`; applies `--project` conventional paths.
 * @throws TruthLayerError CLI_USAGE
 */
export function expandTruthCheckCliArgs(rest: string[]): string[] {
  const args = [...rest];
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--proof") {
      const v = args[i + 1];
      if (v === undefined) {
        throw new TruthLayerError(CLI_OPERATIONAL_CODES.CLI_USAGE, "--proof requires a directory argument.");
      }
      out.push("--write-decision-bundle", v);
      i++;
      continue;
    }
    out.push(a);
  }

  const projected = prepareBatchVerifyArgvForProjectDefaults(out);
  projected.push("--internal-invoked-via-check");
  return projected;
}

export type ParsedQuickCli = {
  inputPath: string;
  exportPath: string;
  emitEventsPath: string | undefined;
  workflowIdQuick: string;
  dbPath: string | undefined;
  postgresUrl: string | undefined;
  shareReportOrigin: string | undefined;
  noHumanReport: boolean;
  writeDecisionBundleDir: string | undefined;
  decisionAttestationPath: string | undefined;
  decisionNextActionPath: string | undefined;
};

/**
 * Parse argv for `agentskeptic quick` (after `quick` token).
 * @throws TruthLayerError CLI_USAGE
 */
export function parseQuickCliArgs(args: string[]): ParsedQuickCli {
  const inputPath = argValue(args, "--input");
  const exportPath = argValue(args, "--export-registry");
  const emitEventsPath = argValue(args, "--emit-events");
  const workflowIdQuick = argValue(args, "--workflow-id") ?? "quick-verify";
  const dbPath = argValue(args, "--db");
  const postgresUrl = argValue(args, "--postgres-url");
  if (!inputPath || !exportPath) {
    throw new TruthLayerError(CLI_OPERATIONAL_CODES.CLI_USAGE, "Missing --input or --export-registry.");
  }
  const dbCount = (dbPath ? 1 : 0) + (postgresUrl ? 1 : 0);
  if (dbCount !== 1) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "Provide exactly one of --db or --postgres-url.",
    );
  }
  return {
    inputPath,
    exportPath,
    emitEventsPath,
    workflowIdQuick,
    dbPath,
    postgresUrl,
    shareReportOrigin: parseOptionalShareReportOrigin(args),
    noHumanReport: args.includes("--no-human-report"),
    writeDecisionBundleDir: argValue(args, "--write-decision-bundle"),
    decisionAttestationPath: argValue(args, "--decision-attestation"),
    decisionNextActionPath: argValue(args, "--decision-next-action"),
  };
}
