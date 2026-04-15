import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isProductionLike } from "@/lib/canonicalSiteOrigin";

export const CORE_DATABASE_BOUNDARY_VIOLATION =
  "AGENTSKEPTIC_CORE_DATABASE_BOUNDARY_VIOLATION: non-production-like process must not use the production core DATABASE_URL fingerprint (see docs/core-database-boundary-ssot.md)";

const FINGERPRINT_FILENAME = "commercial-production-core-database-fingerprint.sha256";

/** Same placeholder as `website/src/db/client.ts` — boundary does not apply. */
const PLACEHOLDER_DSN =
  "postgresql://127.0.0.1:5432/workflow_verifier_build_placeholder";

/**
 * Canonical string for fingerprinting (credentials stripped; sorted query keys).
 * Must stay in sync with `scripts/core-database-boundary-preflight.mjs`.
 */
export function normalizeDatabaseUrlForFingerprint(raw: string): string {
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

export function computeCoreDatabaseFingerprint(raw: string): string {
  return createHash("sha256").update(normalizeDatabaseUrlForFingerprint(raw)).digest("hex");
}

function resolveFingerprintFilePath(): string {
  const candidates = [
    path.join(process.cwd(), "config", FINGERPRINT_FILENAME),
    path.join(process.cwd(), "..", "config", FINGERPRINT_FILENAME),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `coreDatabaseBoundary: missing ${FINGERPRINT_FILENAME} (tried: ${candidates.join(", ")})`,
  );
}

function readForbiddenFingerprintHex(): string {
  const fpPath = resolveFingerprintFilePath();
  const line = readFileSync(fpPath, "utf8").trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(line)) {
    throw new Error(`coreDatabaseBoundary: invalid fingerprint file format at ${fpPath}`);
  }
  return line.toLowerCase();
}

function shouldSkipBoundaryForConnectionString(resolved: string): boolean {
  const t = resolved.trim();
  if (t.length === 0) return true;
  if (t === PLACEHOLDER_DSN) return true;
  return false;
}

/**
 * Blocks non-production-like processes from using the production core DSN fingerprint.
 * Call before opening any `postgres()` client to core `DATABASE_URL`.
 */
export function assertCoreDatabaseBoundary(connectionString: string): void {
  if (isProductionLike()) {
    return;
  }
  if (shouldSkipBoundaryForConnectionString(connectionString)) {
    return;
  }
  const forbidden = readForbiddenFingerprintHex();
  const actual = computeCoreDatabaseFingerprint(connectionString);
  if (actual === forbidden) {
    throw new Error(CORE_DATABASE_BOUNDARY_VIOLATION);
  }
}
