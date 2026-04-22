#!/usr/bin/env node
/**
 * Validates docs/dependency-security-pins.json against package.json files and npm lockfiles.
 * @see docs/dependency-security-pins.schema.json
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function fail(msg) {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function lastNodeModulesName(lockKey) {
  if (lockKey === "") return null;
  const needle = "/node_modules/";
  const idx = lockKey.lastIndexOf(needle);
  if (idx !== -1) return lockKey.slice(idx + needle.length);
  if (lockKey.startsWith("node_modules/")) return lockKey.slice("node_modules/".length);
  return null;
}

function collectInstances(packages, packageName) {
  const out = [];
  if (!packages || typeof packages !== "object") return out;
  for (const k of Object.keys(packages)) {
    if (k === "") continue;
    const name = lastNodeModulesName(k);
    if (name !== packageName) continue;
    const p = packages[k];
    if (!p || typeof p !== "object") continue;
    out.push({
      key: k,
      version: p.version,
      link: Boolean(p.link),
      dev: Boolean(p.dev),
    });
  }
  return out;
}

function websiteWorkspaceFilter(instances) {
  return instances.filter((i) => i.key.startsWith("website/node_modules/") || !i.key.startsWith("website/"));
}

function assertLockRule(rule, lockfileObj, lockLabel) {
  const { package: pkg, match, exactVersion, allowAbsent = false } = rule;
  const packages = lockfileObj.packages;
  let instances = collectInstances(packages, pkg);
  if (match === "websiteWorkspaceExact") {
    instances = websiteWorkspaceFilter(instances);
  }
  const registryInstances = instances.filter((i) => !i.link);
  if (registryInstances.length === 0) {
    if (allowAbsent) return;
    const reason =
      match === "websiteWorkspaceExact"
        ? "no_website_or_hoisted_instance"
        : "no_registry_instance";
    fail(`PIN_LOCK_MISSING lockfile=${lockLabel} package=${pkg} reason=${reason}`);
  }
  for (const inst of registryInstances) {
    if (inst.version !== exactVersion) {
      fail(
        `PIN_LOCK_MISMATCH lockfile=${lockLabel} package=${pkg} key=${inst.key} expected=${exactVersion} actual=${String(inst.version)}`,
      );
    }
  }
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function walkPath(obj, pathKeys) {
  let cur = obj;
  for (const key of pathKeys) {
    if (cur === undefined || cur === null || typeof cur !== "object") return { missing: true };
    cur = cur[key];
  }
  return { value: cur, missing: cur === undefined };
}

const manifestPath = path.join(repoRoot, "docs", "dependency-security-pins.json");
if (!existsSync(manifestPath)) {
  fail("PIN_MANIFEST_MISSING path=docs/dependency-security-pins.json");
}

const manifest = readJson(manifestPath);

for (const entry of manifest.packageJsonExact) {
  const { file, path: pathKeys, value } = entry;
  if (
    file !== "website/package.json" &&
    file !== "package.json" &&
    file !== "test/fixtures/langgraph-node-oracle/package.json"
  ) {
    fail(`PIN_MANIFEST_SCHEMA file=unknown path=packageJsonExact[].file value=${JSON.stringify(file)}`);
  }
  const pjPath = path.join(repoRoot, ...file.split("/"));
  const pj = readJson(pjPath);
  const r = walkPath(pj, pathKeys);
  if (r.missing || r.value !== value) {
    const dot = pathKeys.join(".");
    fail(
      `PIN_MANIFEST_MISMATCH file=${file} path=${dot} expected=${JSON.stringify(value)} actual=${JSON.stringify(r.value)}`,
    );
  }
}

const rootLockPath = path.join(repoRoot, "package-lock.json");
const exLockPath = path.join(repoRoot, "test", "fixtures", "langgraph-node-oracle", "package-lock.json");

for (const [label, p] of [
  ["root", rootLockPath],
  ["example", exLockPath],
]) {
  if (!existsSync(p)) {
    fail(`PIN_LOCK_MISSING file=${path.relative(repoRoot, p)}`);
  }
  const lock = readJson(p);
  if (lock.lockfileVersion !== 3) {
    fail(`PIN_LOCK_UNSUPPORTED file=${path.relative(repoRoot, p)} lockfileVersion=${String(lock.lockfileVersion)}`);
  }
  if (!lock.packages || typeof lock.packages !== "object" || Array.isArray(lock.packages)) {
    fail(`PIN_LOCK_INVALID file=${path.relative(repoRoot, p)} reason=missing_or_invalid_packages`);
  }
}

const rootLock = readJson(rootLockPath);
const exLock = readJson(exLockPath);

for (const rule of manifest.lockfileAssertions) {
  if (rule.lockfile === "root") assertLockRule(rule, rootLock, "root");
  else if (rule.lockfile === "example") assertLockRule(rule, exLock, "example");
  else fail(`PIN_MANIFEST_SCHEMA lockfile=${String(rule.lockfile)}`);
}

process.exit(0);
