#!/usr/bin/env node
/**
 * Preflight: same policy as website/src/lib/coreDatabaseBoundary.ts (keep in sync; parity-tested).
 * Exit 0 = ok; exit 1 = violation or fatal misconfig.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FINGERPRINT_FILENAME = "commercial-production-core-database-fingerprint.sha256";
const PLACEHOLDER_DSN =
  "postgresql://127.0.0.1:5432/workflow_verifier_build_placeholder";

const VIOLATION =
  "AGENTSKEPTIC_CORE_DATABASE_BOUNDARY_VIOLATION: non-production-like process must not use the production core DATABASE_URL fingerprint (see docs/core-database-boundary.md)";

function isProductionLike() {
  return process.env.VERCEL_ENV === "production";
}

export function normalizeDatabaseUrlForFingerprint(raw) {
  const t = raw.trim();
  const forParse = t.replace(/^postgres(ql)?:\/\//i, "http://");
  const u = new URL(forParse);
  const params = new URLSearchParams(u.search);
  const keys = [...params.keys()].sort();
  const q = keys.map((k) => `${k}=${params.get(k)}`).join("&");
  const port = u.port || "5432";
  const host = u.hostname.toLowerCase();
  return `postgresql://${host}:${port}${u.pathname}${q ? `?${q}` : ""}`;
}

export function computeCoreDatabaseFingerprint(raw) {
  return createHash("sha256").update(normalizeDatabaseUrlForFingerprint(raw)).digest("hex");
}

function resolveRepoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

function readForbiddenFingerprintHex() {
  const fpPath = path.join(resolveRepoRoot(), "config", FINGERPRINT_FILENAME);
  if (!existsSync(fpPath)) {
    console.error(`core-database-boundary-preflight: missing ${fpPath}`);
    process.exit(1);
  }
  const line = readFileSync(fpPath, "utf8").trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(line)) {
    console.error(`core-database-boundary-preflight: invalid fingerprint format in ${fpPath}`);
    process.exit(1);
  }
  return line.toLowerCase();
}

function ensureSslModeRequire(connectionUrl) {
  const t = connectionUrl.trim();
  if (!t || !/^postgres(ql)?:/i.test(t)) {
    return t;
  }
  try {
    const forParse = t.replace(/^postgres(ql)?:\/\//i, "http://");
    const host = new URL(forParse).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return t;
    }
  } catch {
    return t;
  }
  if (/[?&]sslmode=require(?:&|$)/i.test(t)) {
    return t;
  }
  if (/[?&]sslmode=/i.test(t)) {
    return t.replace(/([?&])sslmode=[^&]*/gi, "$1sslmode=require");
  }
  return `${t}${t.includes("?") ? "&" : "?"}sslmode=require`;
}

function shouldSkip(resolved) {
  const t = resolved.trim();
  if (t.length === 0) return true;
  if (t === PLACEHOLDER_DSN) return true;
  return false;
}

function main() {
  if (isProductionLike()) {
    process.exit(0);
  }
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    process.exit(0);
  }
  const resolved = ensureSslModeRequire(raw);
  if (shouldSkip(resolved)) {
    process.exit(0);
  }
  const forbidden = readForbiddenFingerprintHex();
  const actual = computeCoreDatabaseFingerprint(resolved);
  if (actual === forbidden) {
    console.error(VIOLATION);
    process.exit(1);
  }
  process.exit(0);
}

main();
