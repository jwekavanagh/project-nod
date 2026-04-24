import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the agentskeptic repository root in Vitest. Some runners give `import.meta.url` a
 * path where `..` from the test file is not the monorepo root. `npm run test:ci` runs with
 * `process.cwd()` equal to the repo root; prefer that when it contains the debug corpus.
 */
export function monorepoRootForVitest(importMetaUrl: string): string {
  const fromMeta = join(dirname(fileURLToPath(importMetaUrl)), "..");
  const runOkMarker = join("examples", "debug-corpus", "run_ok", "agent-run.json");
  if (existsSync(join(process.cwd(), "package.json")) && existsSync(join(process.cwd(), runOkMarker))) {
    return process.cwd();
  }
  if (existsSync(join(fromMeta, "package.json")) && existsSync(join(fromMeta, runOkMarker))) {
    return fromMeta;
  }
  throw new Error(
    `monorepoRootForVitest: cannot find agentskeptic root (cwd=${process.cwd()} fromMeta=${fromMeta})`,
  );
}
