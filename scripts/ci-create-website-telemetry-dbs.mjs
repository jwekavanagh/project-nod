#!/usr/bin/env node
/**
 * For CI: create wfv_website and wfv_telemetry on the local Postgres (superuser URL).
 * Idempotent: ignores "database already exists" (42P04). Uses root `pg` (same as other tooling).
 */
import pg from "pg";

const adminUrl =
  process.env.CI_WFV_ADMIN_URL?.trim() ||
  process.env.POSTGRES_ADMIN_URL?.trim() ||
  "postgresql://postgres:postgres@localhost:5432/postgres";

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
try {
  for (const q of [
    "CREATE DATABASE wfv_website",
    "CREATE DATABASE wfv_telemetry",
  ]) {
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
