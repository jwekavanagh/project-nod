import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type RepoExamplesPaths = {
  examplesDir: string;
  eventsNdjson: string;
  toolsJson: string;
  demoDb: string;
};

function committedExampleFixturesPresent(examplesDir: string): boolean {
  return (
    existsSync(path.join(examplesDir, "events.ndjson")) &&
    existsSync(path.join(examplesDir, "tools.json")) &&
    existsSync(path.join(examplesDir, "seed.sql"))
  );
}

const TMP_DEMO_DB = path.join(os.tmpdir(), "agentskeptic-web-demo.db");

/**
 * `examples/demo.db` is gitignored (`*.db`); clean checkouts only have `seed.sql`.
 * Same materialization as `scripts/demo.mjs` and `examples/github-actions/agentskeptic-commercial.yml`.
 *
 * Serverless bundles ship a read-only `examples/` tree (see `outputFileTracingIncludes`); materialize
 * under `os.tmpdir()` when creating `examples/demo.db` fails.
 */
function materializeDemoDb(seedPath: string, demoDbPath: string): void {
  const sql = readFileSync(seedPath, "utf8");
  mkdirSync(path.dirname(demoDbPath), { recursive: true });
  const db = new DatabaseSync(demoDbPath);
  db.exec(sql);
  db.close();
}

function ensureExamplesDemoDb(examplesDir: string): string {
  const seedPath = path.join(examplesDir, "seed.sql");
  const demoDb = path.join(examplesDir, "demo.db");
  if (existsSync(demoDb)) return demoDb;

  try {
    materializeDemoDb(seedPath, demoDb);
    return demoDb;
  } catch {
    if (existsSync(demoDb)) return demoDb;
  }

  try {
    if (existsSync(TMP_DEMO_DB)) {
      try {
        if (statSync(TMP_DEMO_DB).mtimeMs >= statSync(seedPath).mtimeMs) return TMP_DEMO_DB;
      } catch {
        /* recreate */
      }
      try {
        unlinkSync(TMP_DEMO_DB);
      } catch {
        /* ignore */
      }
    }
    materializeDemoDb(seedPath, TMP_DEMO_DB);
    return TMP_DEMO_DB;
  } catch (e) {
    throw new DemoFixturesMissingError(
      `could not materialize demo.db from ${seedPath} (cwd=${process.cwd()}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Resolve repo `examples/` whether cwd is `website/` or monorepo root.
 */
export function resolveRepoExamplesPaths(): RepoExamplesPaths {
  const candidates = [
    path.join(process.cwd(), "examples"),
    path.join(process.cwd(), "..", "examples"),
    path.join(process.cwd(), "..", "..", "examples"),
  ];
  for (const examplesDir of candidates) {
    if (!committedExampleFixturesPresent(examplesDir)) continue;
    const demoDb = ensureExamplesDemoDb(examplesDir);
    const eventsNdjson = path.join(examplesDir, "events.ndjson");
    const toolsJson = path.join(examplesDir, "tools.json");
    if (existsSync(demoDb) && existsSync(eventsNdjson) && existsSync(toolsJson)) {
      return {
        examplesDir,
        eventsNdjson,
        toolsJson,
        demoDb,
      };
    }
  }
  throw new DemoFixturesMissingError(
    `examples fixtures not found (tried ${candidates.join(", ")}; cwd=${process.cwd()})`,
  );
}

export class DemoFixturesMissingError extends Error {
  readonly code = "DEMO_FIXTURES_MISSING" as const;
  constructor(message: string) {
    super(message);
    this.name = "DemoFixturesMissingError";
  }
}
