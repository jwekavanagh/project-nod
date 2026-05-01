#!/usr/bin/env node
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "artifacts", "generated", "adoption-validation-verdict.json");
const commit = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
if (!/^[0-9a-f]{40}$/.test(commit)) {
  console.error("record-adoption-verdict: invalid commit from git rev-parse HEAD");
  process.exit(1);
}
const recordedAt = new Date().toISOString();
const obj = {
  schemaVersion: 1,
  status: "solved",
  provenBy: "npm_test_chain_exit_0",
  commit,
  recordedAt,
};
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
