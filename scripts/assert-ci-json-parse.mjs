#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "..");
const blobs = [
  join(rootDir, "schemas", "ci", "v4-copy-invariants.manifest.json"),
  join(rootDir, "schemas", "ci", "kernel-browser-open-patterns.json"),
];
let exit = 0;
for (const p of blobs) {
  try {
    JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`[assert-ci-json-parse] invalid JSON or missing ${p}`, e?.message ?? e);
    exit = 1;
  }
}
if (exit === 0) console.error("assert-ci-json-parse: ok");
process.exit(exit);
