import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { TruthLayerError } from "../truthLayerError.js";
import { argValue } from "../cliArgv.js";

const ALLOWED_BOOTSTRAP_FLAGS = new Set([
  "--input",
  "--out",
  "--db",
  "--postgres-url",
  "--help",
  "-h",
]);

function assertBootstrapArgsWellFormed(args: string[]): void {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-h" || a === "--help") continue;
    if (!a.startsWith("--")) {
      throw new TruthLayerError(CLI_OPERATIONAL_CODES.BOOTSTRAP_USAGE, `Unexpected argument: ${a}`);
    }
    if (!ALLOWED_BOOTSTRAP_FLAGS.has(a)) {
      throw new TruthLayerError(CLI_OPERATIONAL_CODES.BOOTSTRAP_USAGE, `Unknown option: ${a}`);
    }
    if (a === "--input" || a === "--out" || a === "--db" || a === "--postgres-url") {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) {
        throw new TruthLayerError(CLI_OPERATIONAL_CODES.BOOTSTRAP_USAGE, `Missing value after ${a}.`);
      }
      i++;
    }
  }
}

export type ParsedBootstrapCli = {
  inputPath: string;
  outPath: string;
  dbPath: string | undefined;
  postgresUrl: string | undefined;
};

export function parseBootstrapCliArgs(args: string[]): ParsedBootstrapCli {
  assertBootstrapArgsWellFormed(args);
  const inputPath = argValue(args, "--input");
  const outPath = argValue(args, "--out");
  const dbPath = argValue(args, "--db");
  const postgresUrl = argValue(args, "--postgres-url");
  if (!inputPath || !outPath) {
    throw new TruthLayerError(CLI_OPERATIONAL_CODES.BOOTSTRAP_USAGE, "Missing --input or --out.");
  }
  const dbCount = (dbPath ? 1 : 0) + (postgresUrl ? 1 : 0);
  if (dbCount !== 1) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.BOOTSTRAP_USAGE,
      "Provide exactly one of --db or --postgres-url.",
    );
  }
  return { inputPath, outPath, dbPath, postgresUrl };
}
