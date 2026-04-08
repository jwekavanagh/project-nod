/**
 * Time-to-first-value gate: quick verify subprocess must finish within budget (spawn timeout + wall clock),
 * stdout QuickVerifyReport, registry bytes match canonical export.
 * Precondition: dist/cli.js exists (run npm run build first).
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  QUICK_VERIFY_SPAWN_TIMEOUT_MS,
  runQuickVerifyPostbuildGate,
} from "./lib/quickVerifyPostbuildGate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");

try {
  readFileSync(cliJs);
} catch {
  console.error("validate-ttfv: run npm run build first");
  process.exit(1);
}

const result = await runQuickVerifyPostbuildGate({
  root,
  cliJs,
  spawnTimeoutMs: QUICK_VERIFY_SPAWN_TIMEOUT_MS,
});

if (result.exitCode !== 0) {
  console.error(result.stderrSummary);
  process.exit(1);
}

process.exit(0);
