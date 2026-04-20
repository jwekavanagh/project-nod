"use strict";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const README_PATH = join(ROOT, "README.md");
const LLMS_ROOT = join(ROOT, "llms.txt");
const LLMS_PUBLIC = join(ROOT, "website", "public", "llms.txt");

const README_START = "<!-- adoption-canonical:start -->";
const README_END = "<!-- adoption-canonical:end -->";
const LLMS_START = "<!-- adoption-canonical-llms:start -->";
const LLMS_END = "<!-- adoption-canonical-llms:end -->";

/**
 * @param {string} readme
 */
function extractReadmeAdoption(readme) {
  const i = readme.indexOf(README_START);
  const j = readme.indexOf(README_END);
  if (i < 0 || j < 0 || j <= i) {
    throw new Error("sync-adoption-canonical-to-llms: missing README adoption markers");
  }
  return readme.slice(i + README_START.length, j).replace(/^\r?\n/, "").replace(/\r?\n$/, "");
}

/**
 * @param {string} llms
 */
function extractLlmsAdoption(llms) {
  const i = llms.indexOf(LLMS_START);
  const j = llms.indexOf(LLMS_END);
  if (i < 0 || j < 0 || j <= i) {
    throw new Error("sync-adoption-canonical-to-llms: missing llms adoption markers");
  }
  return llms.slice(i + LLMS_START.length, j).replace(/^\r?\n/, "").replace(/\r?\n$/, "");
}

/**
 * @param {string} llms
 * @param {string} inner
 */
function replaceLlmsAdoption(llms, inner) {
  const i = llms.indexOf(LLMS_START);
  const j = llms.indexOf(LLMS_END);
  if (i < 0 || j < 0 || j <= i) {
    throw new Error("sync-adoption-canonical-to-llms: missing llms adoption markers");
  }
  const before = llms.slice(0, i + LLMS_START.length);
  const after = llms.slice(j);
  return `${before}\n${inner}\n${after}`;
}

/**
 * @param {string} llms
 */
function ensureLlmsMarkers(llms) {
  if (llms.includes(LLMS_START) && llms.includes(LLMS_END)) return llms;
  if (llms.includes(LLMS_START) !== llms.includes(LLMS_END)) {
    throw new Error("sync-adoption-canonical-to-llms: partial llms markers");
  }
  const needle = "## Summary\n";
  const k = llms.indexOf(needle);
  if (k < 0) throw new Error("sync-adoption-canonical-to-llms: llms.txt missing ## Summary");
  const insertAt = k + needle.length;
  const block = `\n${LLMS_START}\n\n${LLMS_END}\n`;
  return llms.slice(0, insertAt) + block + llms.slice(insertAt);
}

const check = process.argv.includes("--check");

const readme = readFileSync(README_PATH, "utf8");
const excerpt = extractReadmeAdoption(readme);

for (const dest of [LLMS_ROOT, LLMS_PUBLIC]) {
  // `website/public/llms.txt` is gitignored; CI only has repo-root `llms.txt` until
  // `npm run sync:public-product-anchors` / website prebuild materializes the copy.
  if (!existsSync(dest)) {
    if (dest === LLMS_PUBLIC) continue;
    throw new Error(`sync-adoption-canonical-to-llms: missing required file ${dest}`);
  }
  let llms = readFileSync(dest, "utf8");
  llms = ensureLlmsMarkers(llms);
  if (check) {
    const current = extractLlmsAdoption(llms);
    if (current !== excerpt) {
      console.error(`sync-adoption-canonical-to-llms: --check mismatch for ${dest}`);
      process.exit(1);
    }
  } else {
    llms = replaceLlmsAdoption(llms, excerpt);
    writeFileSync(dest, llms, "utf8");
  }
}
