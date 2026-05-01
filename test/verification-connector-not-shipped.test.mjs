/**
 * OSS build rejects BigQuery connectors before shipping heavy client SDKs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("openVerificationSqlTarget rejects bigquery with VERIFICATION_CONNECTOR_NOT_SHIPPED", async () => {
  const build = spawnSync("npm run build", { cwd: root, encoding: "utf8", shell: true });
  assert.equal(build.status, 0, build.stderr || build.stdout || "npm run build failed");
  mkdirSync(join(root, "dist"), { recursive: true });
  const mod = await import(pathToFileURL(join(root, "dist", "verificationConnections.js")).href);
  await assert.rejects(
    async () =>
      mod.openVerificationSqlTarget({
        kind: "bigquery",
        connectionString: "bigquery://unit/discard",
      }),
    (/** @type {unknown} */ e) => {
      assert.ok(e && typeof e === "object");
      const err = /** @type {{ code?: unknown; message?: unknown }} */ (e);
      assert.equal(err.code, "VERIFICATION_CONNECTOR_NOT_SHIPPED");
      assert.equal(err.message, `Verification connector "bigquery" is not shipped in this package build.`);
      return true;
    },
  );
});
