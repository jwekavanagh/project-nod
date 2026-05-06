"use strict";

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const ROOT = join(__dirname, "..");
const MARKETING_PATH = join(ROOT, "config", "marketing.json");

/**
 * @param {string} s
 */
function normalize(s) {
  const t = String(s).trim();
  if (!t) throw new Error("normalize: empty origin");
  const u = new URL(t);
  return u.origin;
}

function isLoopbackOrigin(raw) {
  try {
    const u = new URL(normalize(raw));
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

function readProductionCanonicalOrigin() {
  const pm = JSON.parse(readFileSync(MARKETING_PATH, "utf8"));
  return String(pm.productionCanonicalOrigin);
}

/**
 * Canonical browser URL for the repo markdown SSOT `docs/first-truth-check.md` (OpenAPI externalDocs + discovery).
 * @param {string} gitRepositoryUrl e.g. https://github.com/org/repo or …/repo.git
 */
function runtimeTruthCheckGuideBlobUrl(gitRepositoryUrl) {
  const base = String(gitRepositoryUrl)
    .replace(/\.git$/i, "")
    .replace(/\/$/, "");
  return `${base}/blob/main/docs/first-truth-check.md`;
}

function assertNextPublicOriginParity() {
  const canonicalFromJson = readProductionCanonicalOrigin();
  const skip = process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
  if (skip) return;
  const url = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!url) return;
  if (normalize(url) !== normalize(canonicalFromJson)) {
    if (process.env.VERCEL_ENV !== "production" && isLoopbackOrigin(url)) return;
    throw new Error("NEXT_PUBLIC_APP_URL must equal productionCanonicalOrigin");
  }
}

module.exports = {
  normalize,
  runtimeTruthCheckGuideBlobUrl,
  assertNextPublicOriginParity,
  MARKETING_PATH,
  /** @deprecated use MARKETING_PATH */
  PRIMARY_MARKETING_PATH: MARKETING_PATH,
};
