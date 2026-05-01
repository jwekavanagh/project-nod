#!/usr/bin/env node
/**
 * Measures npm pack tarball size and a production-only install footprint (file count under node_modules).
 * Emits a single JSON object to stdout (stable field order for drift review).
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();

function gitHeadSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: root }).trim();
  } catch {
    return "";
  }
}

function countNodeModuleFiles(nmDir) {
  let n = 0;
  const stack = [nmDir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else if (ent.isFile()) n += 1;
    }
  }
  return n;
}

function npmPackTarballAbsPath() {
  const r = spawnSync("npm", ["pack", "--silent", "."], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", process.platform === "win32" ? "ignore" : "pipe"],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error("[measure-npm-footprint] npm pack failed:", r.stderr || r.stdout);
    process.exit(1);
  }
  const name = r.stdout.trim().split(/\r?\n/).pop()?.trim();
  if (!name) {
    console.error("[measure-npm-footprint] npm pack produced empty output");
    process.exit(1);
  }
  return join(root, name);
}

function pkgVersion() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version ?? "";
}

function auditHighCritical(installRoot) {
  const r = spawnSync("npm", ["audit", "--json", "--omit=dev"], {
    cwd: installRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  /** @type {any} */
  let j = {};
  try {
    j = JSON.parse(r.stdout || "{}");
  } catch {
    return { high: null, critical: null };
  }
  const mh = j?.metadata?.vulnerabilities;
  const high = typeof mh?.high === "number" ? mh.high : null;
  const critical = typeof mh?.critical === "number" ? mh.critical : null;
  return { high, critical };
}

const tarball = npmPackTarballAbsPath();
let tgzBytes = 0;
try {
  tgzBytes = statSync(tarball).size;
} finally {
  try {
    unlinkSync(tarball);
  } catch {
    /* ignore */
  }
}

const stage = mkdtempSync(join(tmpdir(), "agentskeptic-footprint-"));
const installRoot = join(stage, "consumer");
mkdirSync(installRoot, { recursive: true });
const innerPack = npmPackTarballAbsPath();
const destName = innerPack.split(/[/\\]/).pop() ?? "pack.tgz";
const destTgz = join(stage, destName);
copyFileSync(innerPack, destTgz);
try {
  unlinkSync(innerPack);
} catch {
  /* ignore */
}

writeFileSync(
  join(installRoot, "package.json"),
  JSON.stringify({ name: "footprint-consumer", private: true, type: "module" }, null, 2),
);
const t0 = performance.now();
const inst = spawnSync("npm", ["install", destTgz, "--omit=dev", "--no-audit", "--no-fund"], {
  cwd: installRoot,
  encoding: "utf8",
  // Must not inherit stdout: this script emits exactly one JSON line to stdout for assert-npm-footprint-improved.mjs.
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});
const wallMs = Math.round(performance.now() - t0);
if (inst.status !== 0) {
  console.error(
    "[measure-npm-footprint] npm install failed in temp consumer:",
    inst.stderr || inst.stdout || "",
  );
  process.exit(1);
}

const nm = join(installRoot, "node_modules");
const productionNodeModulesEntryCount = countNodeModuleFiles(nm);
const { high, critical } = auditHighCritical(installRoot);
const auditHighPlusCritical = high !== null && critical !== null ? high + critical : null;

const out = {
  packedTarballBytes: tgzBytes,
  packageJsonVersion: pkgVersion(),
  gitHeadSha: gitHeadSha(),
  productionInstallWallClockMs: wallMs,
  productionNodeModulesEntryCount,
  auditHighPlusCritical,
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
