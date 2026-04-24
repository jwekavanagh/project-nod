#!/usr/bin/env node
/**
 * @esbuild-kit/core-utils declares esbuild ~0.18.20 (affected by GHSA-67mh-4wv8-2f99). We pin 0.25.12+ via
 * patch-package, but the lockfile can still list 0.18.20, which re-triggers Dependabot. This script copies
 * the hoisted 0.25.12 package entries in package-lock v3 from `node_modules/@esbuild/...` and
 * `node_modules/esbuild` into `node_modules/@esbuild-kit/core-utils/node_modules/...` so the lock matches
 * the resolved tree. Run after `npx patch-package` + `npm install` when the patch changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, "package-lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const { packages: pk } = lock;
if (!pk || typeof pk !== "object") {
  process.stderr.write("align-esbuild-kit-lock-nested: invalid package-lock (no packages)\n");
  process.exit(1);
}

const NESTED = "node_modules/@esbuild-kit/core-utils/node_modules";
const COPY_KEYS = new Set([
  "version",
  "resolved",
  "integrity",
  "dev",
  "license",
  "bin",
  "hasInstallScript",
  "engines",
  "cpu",
  "os",
  "optional",
  "funding",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
]);

let updated = 0;
for (const toKey of Object.keys(pk)) {
  if (!toKey.startsWith(`${NESTED}/`)) continue;
  const rel = toKey.slice(NESTED.length + 1);
  const fromKey = `node_modules/${rel}`;
  const src = pk[fromKey];
  const dest = pk[toKey];
  if (!src || !dest) continue;
  for (const k of COPY_KEYS) {
    if (k in src) dest[k] = src[k];
  }
  updated++;
}
const utilKey = "node_modules/@esbuild-kit/core-utils";
if (pk[utilKey]?.dependencies) {
  pk[utilKey].dependencies.esbuild = "0.25.12";
}

writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
process.stdout.write(
  `align-esbuild-kit-lock-nested: updated ${String(updated)} nested entries; ${utilKey} esbuild=0.25.12\n`,
);
