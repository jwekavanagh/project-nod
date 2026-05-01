#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "artifacts", "generated", "adoption-validation-verdict.json");
let raw;
try {
  raw = readFileSync(path, "utf8");
} catch (e) {
  console.error("verify-adoption-verdict: could not read verdict file");
  process.exit(1);
}
let j;
try {
  j = JSON.parse(raw);
} catch {
  console.error("verify-adoption-verdict: invalid JSON");
  process.exit(1);
}
if (j.schemaVersion !== 1 || typeof j.schemaVersion !== "number") {
  console.error("verify-adoption-verdict: bad schemaVersion");
  process.exit(1);
}
if (j.status !== "solved") {
  console.error("verify-adoption-verdict: bad status");
  process.exit(1);
}
if (j.provenBy !== "npm_test_chain_exit_0") {
  console.error("verify-adoption-verdict: bad provenBy");
  process.exit(1);
}
if (typeof j.commit !== "string" || !/^[0-9a-f]{40}$/.test(j.commit)) {
  console.error("verify-adoption-verdict: bad commit");
  process.exit(1);
}
if (typeof j.recordedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(j.recordedAt)) {
  console.error("verify-adoption-verdict: bad recordedAt");
  process.exit(1);
}
const head = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
if (j.commit !== head) {
  console.error("verify-adoption-verdict: commit mismatch");
  process.exit(1);
}
