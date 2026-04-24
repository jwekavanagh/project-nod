/**
 * Published tarball must ship discovery payload JSON and CI renderer scripts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const REQUIRED = [
  "dist/discovery-payload-v1.json",
  "scripts/discovery-payload.lib.cjs",
  "scripts/discovery-acquisition.lib.cjs",
  "scripts/emit-primary-marketing.cjs",
  "scripts/origin.cjs",
  "config/marketing.json",
  "scripts/validate-marketing.cjs",
  "scripts/render-discovery-ci.mjs",
];

test("npm pack --dry-run --json lists discovery artifacts", () => {
  // --ignore-scripts: root `prepare` (patch-package, husky) must not print to stdout or JSON.parse fails.
  const r = spawnSync("npm pack --dry-run --json --ignore-scripts", {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const rows = JSON.parse(r.stdout);
  assert.ok(Array.isArray(rows) && rows.length >= 1);
  const files = rows[0].files.map((/** @type {{ path: string }} */ f) => f.path);
  for (const p of REQUIRED) {
    assert.ok(files.includes(p), `missing packed file: ${p}`);
  }
});
