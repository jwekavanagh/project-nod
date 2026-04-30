#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.WF_BUILD_PROFILE = "commercial";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run(process.execPath, ["scripts/write-commercial-build-flags.mjs", "--commercial"]);
run(process.execPath, ["scripts/sync-failure-origin-from-schema.mjs"]);
const tscJs = path.join(root, "node_modules", "typescript", "lib", "tsc.js");
run(process.execPath, [tscJs]);
run(process.execPath, ["scripts/write-execution-identity.mjs"]);
run(process.execPath, ["scripts/copy-debug-ui.mjs"]);
run(process.execPath, ["scripts/write-discovery-payload.mjs"]);
