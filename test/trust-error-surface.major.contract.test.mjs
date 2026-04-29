/**
 * Ensures semver-major **`TrustDecisionBlockedError`** is the lone blocked-decision throwable on the **`dist`** surface.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(fileURLToPath(new URL("../", import.meta.url)));
const distJs = join(root, "dist", "index.js");

if (!existsSync(distJs)) {
  console.warn("[trust-error-surface.major] skipping: dist/index.js absent (run after build)");
  process.exit(0);
}

const m = await import(pathToFileURL(distJs).href);
assert.equal(typeof m.TrustDecisionBlockedError, "function");
assert.equal(m.DecisionUnsafeError, undefined);
assert.equal(m.LangGraphCheckpointTrustUnsafeError, undefined);
