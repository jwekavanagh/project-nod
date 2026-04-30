#!/usr/bin/env node
/**
 * Writes dist/execution-identity.v1.json after tsc — deterministic identity pin for npm tarball.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLOSED_DRIFT_ARTIFACT_REL_PATHS } from "./enumerate-drift-artifacts.mjs";
import { PYTHON_PIP_EXTRAS_FRAGMENT } from "./execution-identity-constants.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const MANIFEST = join(root, "schemas", "ci", "verification-truth.manifest.json");
const PKG = join(root, "package.json");
const OUT = join(root, "dist", "execution-identity.v1.json");

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

function fingerprint(manifest) {
  const reg = manifest.regeneration.scripts.map((s) => `${s.cwd}:${s.npmScript}`);
  const body = canonicalJson({
    closedDriftPaths: [...CLOSED_DRIFT_ARTIFACT_REL_PATHS],
    regenerationScripts: reg,
  });
  return createHash("sha256").update(Buffer.from(body, "utf8")).digest("hex");
}

function main() {
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const pin = pkg.verificationContractManifest;
  if (!pin) throw new Error("package.json missing verificationContractManifest");

  const drift = manifest.gating.closedDriftPaths;
  const enumList = [...CLOSED_DRIFT_ARTIFACT_REL_PATHS];
  if (drift.length !== enumList.length || drift.some((p, i) => p !== enumList[i])) {
    throw new Error("write-execution-identity: manifest.gating.closedDriftPaths != enumerator (run sync)");
  }

  const mergeGateFingerprintSha256 = fingerprint(manifest);

  const doc = {
    $schema: "https://agentskeptic.com/schemas/execution-identity-v1.schema.json",
    closedDriftPathCount: enumList.length,
    identityVersion: "1.0.0",
    mergeGateFingerprintSha256,
    nodeEnginesDeclared: String(pkg.engines?.node ?? ""),
    npmPackageVersion: String(pkg.version ?? "").trim(),
    pythonPipExtrasFragment: PYTHON_PIP_EXTRAS_FRAGMENT,
    verificationContractManifest: {
      manifestSha256: String(pin.manifestSha256),
      url: String(pin.url),
      version: String(pin.version),
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, canonicalJson(doc), "utf8");
  console.error(`write-execution-identity: wrote ${OUT}`);
}

main();
