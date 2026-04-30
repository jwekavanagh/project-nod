#!/usr/bin/env node
/**
 * Live parity: fetched verification contract manifest (same sealing algorithm as contract-manifest.mjs)
 * must match committed schemas/contract/v1.json head seal + package pin. Not invoked from merge gate.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}

function canonicalize(value) {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

/** Mirrors scripts/contract-manifest.mjs computeManifestSha256 (head seal zeroed). */
function computeManifestSha256(manifest) {
  const clone = JSON.parse(JSON.stringify(manifest));
  const last = clone.history[clone.history.length - 1];
  last.manifestSha256 = "";
  const bytes = canonicalize(clone);
  return createHash("sha256").update(Buffer.from(bytes, "utf8")).digest("hex");
}

const pkgPath = join(root, "package.json");
const canonPath = join(root, "schemas", "contract", "v1.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const pin = pkg.verificationContractManifest;
if (!pin?.url || !pin.manifestSha256) {
  console.error("[assert-public-contract-url] package.json missing verificationContractManifest.url / manifestSha256");
  process.exit(1);
}

const committedText = readFileSync(canonPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const committed = JSON.parse(committedText);
const head = committed.history[committed.history.length - 1];
if (!head?.manifestSha256) {
  console.error("[assert-public-contract-url] committed manifest missing history head seal");
  process.exit(1);
}
const recommit = computeManifestSha256(committed);
if (recommit !== head.manifestSha256 || recommit !== pin.manifestSha256) {
  console.error(
    `[assert-public-contract-url] seal drift: recomputed=${recommit} head=${head.manifestSha256} pin=${pin.manifestSha256} — run contract-manifest tooling`,
  );
  process.exit(1);
}

const url = String(pin.url);
console.error(`[assert-public-contract-url] GET ${url}`);
const res = await fetch(url);
if (!res.ok) {
  console.error(`[assert-public-contract-url] HTTP ${res.status}`);
  process.exit(1);
}
const remoteText = (await res.text()).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
const remote = JSON.parse(remoteText);
const remoteSeal = computeManifestSha256(remote);
const remoteHead = remote.history?.[remote.history.length - 1];
if (!remoteHead?.manifestSha256 || remoteSeal !== remoteHead.manifestSha256) {
  console.error("[assert-public-contract-url] remote manifest seal mismatch or unparsable");
  process.exit(1);
}
if (remoteSeal !== head.manifestSha256) {
  console.error(
    `[assert-public-contract-url] live manifest seal ${remoteSeal} != committed ${head.manifestSha256}`,
  );
  process.exit(1);
}

console.error("[assert-public-contract-url] ok");
