#!/usr/bin/env node
/**
 * For CI and `verification:truth:local`: ensure canonical website/telemetry DBs exist on the
 * target Postgres (superuser or owner URL). Idempotent: ignores "database already exists" (42P04).
 *
 * Admin connection:
 * - `CI_WFV_ADMIN_URL` or `POSTGRES_ADMIN_URL` when set (explicit superuser to `postgres` DB), else
 * - derive from `DATABASE_URL` (same host/port/user/password, database `postgres`) so local
 *   `.env` ports (e.g. 5433) match created DBs, else
 * - default `postgresql://postgres:postgres@localhost:5432/postgres`.
 *
 * Databases created: `wfv_website`, `wfv_telemetry`, `wfv_commercial`, plus the database name(s)
 * parsed from `DATABASE_URL` and `TELEMETRY_DATABASE_URL` when present (covers `website/.env.example`
 * using `wfv_commercial` for `DATABASE_URL`).
 */
import pg from "pg";

/** @param {string} raw */
function parsePostgresConnection(raw) {
  const t = raw.trim();
  const forParse = t.replace(/^postgres(ql)?:\/\//i, "http://");
  const u = new URL(forParse);
  const dbPath = (u.pathname || "/").replace(/^\//, "");
  const database = dbPath ? decodeURIComponent(dbPath) : "";
  return {
    user: decodeURIComponent(u.username || "postgres"),
    password: decodeURIComponent(u.password || ""),
    host: u.hostname,
    port: u.port || "5432",
    database,
  };
}

/** @param {{ user: string; password: string; host: string; port: string }} parts */
function buildPostgresUrl(parts, database) {
  const { user, password, host, port } = parts;
  const auth =
    user && password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
      : user
        ? `${encodeURIComponent(user)}@`
        : "";
  return `postgresql://${auth}${host}:${port}/${database}`;
}

function resolveAdminUrl() {
  const explicit =
    process.env.CI_WFV_ADMIN_URL?.trim() ||
    process.env.POSTGRES_ADMIN_URL?.trim() ||
    "";
  if (explicit) return explicit;

  const dbUrl = process.env.DATABASE_URL?.trim();
  if (dbUrl) {
    try {
      const p = parsePostgresConnection(dbUrl);
      return buildPostgresUrl(p, "postgres");
    } catch {
      /* fall through */
    }
  }
  return "postgresql://postgres:postgres@localhost:5432/postgres";
}

/** @param {string} name */
function isSafeDbName(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function resolveDatabasesToCreate() {
  /** @type {Set<string>} */
  const names = new Set(["wfv_website", "wfv_telemetry", "wfv_commercial"]);
  for (const raw of [process.env.DATABASE_URL, process.env.TELEMETRY_DATABASE_URL]) {
    if (!raw?.trim()) continue;
    try {
      const { database } = parsePostgresConnection(raw);
      if (database && database !== "postgres") names.add(database);
    } catch {
      /* ignore */
    }
  }
  return [...names];
}

const adminUrl = resolveAdminUrl();
const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
try {
  for (const dbName of resolveDatabasesToCreate()) {
    if (!isSafeDbName(dbName)) {
      console.error(`ci-create-website-telemetry-dbs: skipping invalid database name: ${dbName}`);
      continue;
    }
    const q = `CREATE DATABASE ${dbName}`;
    try {
      await client.query(q);
    } catch (e) {
      const c = /** @type {{ code?: string }} */ (e).code;
      if (c === "42P04") continue;
      throw e;
    }
  }
} finally {
  await client.end();
}
