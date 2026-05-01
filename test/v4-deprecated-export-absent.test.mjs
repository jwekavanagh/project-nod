/**
 * Consumers must not resolve verifyWorkflow from the root package barrel (v4+).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const proj = join(root, "test", "fixtures", "v4-api-consumer");

test("root package typings reject verifyWorkflow consumer import", async () => {
  const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["tsc", "-p", proj, "--noEmit"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  assert.equal(r.status, 2, `expected TS2305-style failure, got ${r.status}: ${r.stdout}${r.stderr}`);
  const stderr = `${r.stdout}\n${r.stderr}`;
  assert.match(stderr, /(TS2305|TS2724)/);
  assert.match(stderr, /verifyWorkflow/);
});
