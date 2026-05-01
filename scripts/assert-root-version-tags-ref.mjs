#!/usr/bin/env node
/**
 * Fails unless root package.json "version" exactly matches GITHUB_REF_NAME without a leading v.
 * Intended for CI on SemVer git tags (GITHUB_REF_NAME is the short tag, e.g. v1.2.3).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const refName = String(process.env.GITHUB_REF_NAME ?? "").trim();
if (!/^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-|$|\+)/.test(refName)) {
  console.error(
    `assert-root-version-tags-ref: GITHUB_REF_NAME must look like SemVer tag vX.Y.Z*, got "${refName}"`,
  );
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const pjVersion = String(pkg.version ?? "").trim();
const tagSansV = refName.startsWith("v") ? refName.slice(1) : refName;
if (pjVersion !== tagSansV) {
  console.error(
    `assert-root-version-tags-ref: package.json version "${pjVersion}" !== tag-derived "${tagSansV}" from "${refName}"`,
  );
  process.exit(1);
}

console.log(`assert-root-version-tags-ref: ok package.json=${pjVersion} tag=${refName}`);
