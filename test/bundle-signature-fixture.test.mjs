/**
 * Committed v2 signed bundle: CLI verify-bundle-signature must exit 0 (requires dist/ from npm run build).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const cliJs = join(root, "dist", "cli.js");
const runDir = join(root, "test", "fixtures", "signed-bundle-v2");
const publicKey = join(runDir, "ed25519-public.pem");

describe("bundle signature fixture (CLI)", () => {
  it("verify-bundle-signature exits 0 for committed signed-bundle-v2", () => {
    const r = spawnSync(
      process.execPath,
      ["--no-warnings", cliJs, "verify-bundle-signature", "--run-dir", runDir, "--public-key", publicKey],
      { encoding: "utf8", cwd: root },
    );
    assert.equal(r.status, 0, r.stderr);
  });
});
