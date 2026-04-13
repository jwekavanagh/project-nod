import path from "node:path";

/**
 * Normalized absolute paths (forward slashes, lowercased) that count as bundled repo examples
 * for funnel workload_class (must match plan SSOT list).
 */
const BUNDLED_PATH_SUFFIXES = [
  "/examples/events.ndjson",
  "/examples/tools.json",
  "/examples/demo.db",
  "/examples/partner-quickstart/partner.events.ndjson",
  "/examples/partner-quickstart/partner.tools.json",
  "/examples/partner-quickstart/partner.seed.sql",
] as const;

function normalizedAbsolutePath(p: string): string {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

function matchesBundledExample(np: string): boolean {
  return BUNDLED_PATH_SUFFIXES.some((s) => np.endsWith(s));
}

export function classifyBatchVerifyWorkload(input: {
  eventsPath: string;
  registryPath: string;
  database: { kind: "sqlite"; path: string } | { kind: "postgres"; connectionString: string };
}): "bundled_examples" | "non_bundled" {
  if (input.database.kind === "postgres") return "non_bundled";
  const ev = normalizedAbsolutePath(input.eventsPath);
  const reg = normalizedAbsolutePath(input.registryPath);
  const db = normalizedAbsolutePath(input.database.path);
  if (!matchesBundledExample(ev) || !matchesBundledExample(reg) || !matchesBundledExample(db)) {
    return "non_bundled";
  }
  return "bundled_examples";
}

export function classifyQuickVerifyWorkload(input: {
  inputPath: string;
  sqlitePath?: string;
  postgresUrl?: string;
}): "bundled_examples" | "non_bundled" {
  if (input.postgresUrl !== undefined && input.postgresUrl.trim().length > 0) {
    return "non_bundled";
  }
  if (input.inputPath === "-") return "non_bundled";
  const inp = normalizedAbsolutePath(input.inputPath);
  if (!matchesBundledExample(inp)) return "non_bundled";
  if (input.sqlitePath === undefined) return "non_bundled";
  const db = normalizedAbsolutePath(input.sqlitePath);
  if (!matchesBundledExample(db)) return "non_bundled";
  return "bundled_examples";
}
