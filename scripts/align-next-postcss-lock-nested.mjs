#!/usr/bin/env node
/**
 * Next.js 16.2.x pins postcss@8.4.31 as a nested dependency (GHSA-qx2v-qp2m-jg93).
 * Root overrides hoist website/vite postcss to 8.5.10 but do not always rewrite the
 * next/node_modules/postcss lock entry. Copy the hoisted registry metadata into that
 * nested slot and bump next's declared postcss version.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const { packages: pk } = lock;
if (!pk || typeof pk !== "object") {
  process.stderr.write("align-next-postcss-lock-nested: invalid package-lock (no packages)\n");
  process.exit(1);
}

const nextKey = "node_modules/next";
const nestedKey = "node_modules/next/node_modules/postcss";
const hoistedKey = "node_modules/postcss";
const PATCHED = "8.5.10";

if (!pk[nextKey]) {
  process.stdout.write("align-next-postcss-lock-nested: no next in lockfile; skipping\n");
  process.exit(0);
}

const hoisted = pk[hoistedKey];
const nested = pk[nestedKey];
if (!hoisted || hoisted.version !== PATCHED) {
  process.stderr.write(
    `align-next-postcss-lock-nested: expected ${hoistedKey}@${PATCHED} (got ${String(hoisted?.version)})\n`,
  );
  process.exit(1);
}

if (!nested) {
  process.stdout.write("align-next-postcss-lock-nested: no nested postcss under next; skipping\n");
  process.exit(0);
}

if (nested.version === PATCHED) {
  if (pk[nextKey].dependencies?.postcss === PATCHED) {
    process.stdout.write("align-next-postcss-lock-nested: already aligned\n");
    process.exit(0);
  }
}

const COPY_KEYS = new Set([
  "version",
  "resolved",
  "integrity",
  "license",
  "dependencies",
  "engines",
  "funding",
]);

for (const k of COPY_KEYS) {
  if (k in hoisted) nested[k] = hoisted[k];
}

if (pk[nextKey].dependencies) {
  pk[nextKey].dependencies.postcss = PATCHED;
}

writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
process.stdout.write(`align-next-postcss-lock-nested: nested postcss aligned to ${PATCHED}\n`);
