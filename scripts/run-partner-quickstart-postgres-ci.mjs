#!/usr/bin/env node
/**
 * CI helper: if POSTGRES_ADMIN_URL is set, provision an empty Postgres database and run
 * partner-quickstart-verify with PARTNER_POSTGRES_URL pointed at it.
 *
 * Uses a dedicated DB so partner.seed.sql (CREATE TABLE contacts …) does not collide with
 * tables already created by scripts/pg-ci-init.mjs on the default `postgres` database.
 * No-op exit 0 when POSTGRES_ADMIN_URL is unset (local dev without postgres CI vars).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const PARTNER_CI_DB = "wfv_partner_quickstart_ci";

const admin = process.env.POSTGRES_ADMIN_URL?.trim();
if (!admin) {
  process.exit(0);
}

/** @param {string} connectionString @param {string} database */
function withDatabase(connectionString, database) {
  const u = new URL(connectionString);
  u.pathname = "/" + database;
  return u.href;
}

async function main() {
  const adminClient = new pg.Client({ connectionString: admin });
  await adminClient.connect();
  try {
    await adminClient.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [PARTNER_CI_DB],
    );
    await adminClient.query(`DROP DATABASE IF EXISTS ${PARTNER_CI_DB}`);
    await adminClient.query(`CREATE DATABASE ${PARTNER_CI_DB}`);
  } finally {
    await adminClient.end();
  }

  const partnerUrl = withDatabase(admin, PARTNER_CI_DB);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const env = { ...process.env, PARTNER_POSTGRES_URL: partnerUrl };
  const r = spawnSync(process.execPath, ["scripts/partner-quickstart-verify.mjs"], {
    cwd: root,
    stdio: "inherit",
    env,
  });
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
