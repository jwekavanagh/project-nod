#!/usr/bin/env node
/**
 * Static repo policy + API surface guards (formerly part of verify.mjs nodeGuards).
 * contract-manifest --check and codegen freshness run in verification-truth gating before this.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function run(cmd) {
  console.error(`[verification-truth:guards] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env, cwd: root, shell: true });
}

/**
 * Does not include contract-manifest (run before) or assert-openapi-types-fresh (superseded by codegen + git diff).
 */
export function runRepoPolicyAndApiGuards() {
  run(
    "node scripts/align-esbuild-kit-lock-nested.mjs && " +
      "node scripts/assert-version-integrity.mjs && " +
      "node scripts/assert-dependency-security-pins.mjs && " +
      "node scripts/assert-no-legacy-verify-surface.mjs && " +
      "node scripts/assert-no-withWorkflowVerification-surface.mjs && " +
      "node scripts/assert-openapi-covers-activation-routes.mjs && " +
      "node scripts/assert-trust-major-export-surface.mjs && " +
      "node scripts/assert-commercial-trust-ingest-rules.mjs && " +
      "node scripts/check-agentskeptic-compare-delegation.mjs && " +
      "node scripts/assert-no-adhoc-fetch-for-activation.mjs && " +
      "node scripts/assert-error-code-parity.mjs && " +
      "node scripts/assert-pydantic-matches-openapi.mjs && " +
      "node scripts/assert-deprecations-still-export.mjs && " +
      "node scripts/assert-python-httpx-scope.mjs",
  );
}
