#!/usr/bin/env node
/**
 * Sanctioned drizzle-kit entry: runs core DB boundary preflight then forwards argv to drizzle-kit.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preflight = path.join(websiteRoot, "..", "scripts", "core-database-boundary-preflight.mjs");
const pre = spawnSync(process.execPath, [preflight], { env: process.env, stdio: "inherit" });
if (pre.status !== 0) {
  process.exit(pre.status === null ? 1 : pre.status);
}

const drizzleKit = path.join(websiteRoot, "..", "node_modules", "drizzle-kit", "bin.cjs");
const args = process.argv.slice(2);
const r = spawnSync(process.execPath, [drizzleKit, ...args], {
  cwd: websiteRoot,
  env: process.env,
  stdio: "inherit",
});
process.exit(r.status === 0 ? 0 : r.status ?? 1);
