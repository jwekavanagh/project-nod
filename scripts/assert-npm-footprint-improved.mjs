#!/usr/bin/env node
/**
 * Re-measures footprint vs committed v3.7.0 baseline:
 * production node_modules entry count must be strictly smaller; packed tarball bytes may be
 * at most ~3% above baseline (small first-party bundle growth is allowed while install lean wins).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TAR_PACK_SLACK_VS_V37 = 0.03;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const baselinePath = join(root, "test", "fixtures", "npm-footprint", "v3.7.0-baseline.json");

const r = spawnSync(process.execPath, [join(root, "scripts", "measure-npm-footprint.mjs")], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
if (r.status !== 0) {
  console.error("[assert-npm-footprint-improved] measure failed:", r.stderr || r.stdout);
  process.exit(1);
}
const measureOut =
  typeof r.stdout === "string" ? r.stdout : Buffer.isBuffer(r.stdout) ? r.stdout.toString("utf8") : String(r.stdout ?? "");
/** @type {{ packedTarballBytes: number; productionNodeModulesEntryCount: number; auditHighPlusCritical: number | null }} */
const current = JSON.parse(measureOut.replace(/^\uFEFF/, "").trim());
const baselineRaw = readFileSync(baselinePath, "utf8").replace(/^\uFEFF/, "").trimStart();
/** @type {{ packedTarballBytes: number; productionNodeModulesEntryCount: number }} */
const baseline = JSON.parse(baselineRaw);

console.error(
  "[assert-npm-footprint-improved] baseline packedTarballBytes=%s node_modules_files=%s auditH+C=%s",
  baseline.packedTarballBytes,
  baseline.productionNodeModulesEntryCount,
  baseline.auditHighPlusCritical ?? "null",
);
console.error(
  "[assert-npm-footprint-improved] current  packedTarballBytes=%s node_modules_files=%s auditH+C=%s",
  current.packedTarballBytes,
  current.productionNodeModulesEntryCount,
  current.auditHighPlusCritical ?? "null",
);

let bad = false;
const tarballCeil = Math.ceil(baseline.packedTarballBytes * (1 + TAR_PACK_SLACK_VS_V37));
if (current.packedTarballBytes > tarballCeil) {
  console.error(
    "[assert-npm-footprint-improved] packed tarball exceeds baseline v3.7.0 by more than %s%% (current=%s baseline=%s max=%s)",
    String(TAR_PACK_SLACK_VS_V37 * 100),
    current.packedTarballBytes,
    baseline.packedTarballBytes,
    tarballCeil,
  );
  bad = true;
}
if (!(current.productionNodeModulesEntryCount < baseline.productionNodeModulesEntryCount)) {
  console.error("[assert-npm-footprint-improved] production node_modules file count not strictly smaller than baseline");
  bad = true;
}
if (bad) process.exit(1);
console.error("assert-npm-footprint-improved: ok");
