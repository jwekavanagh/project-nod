import { assertCoreDatabaseBoundary } from "@/lib/coreDatabaseBoundary";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ensureSslModeRequire } from "./ensureSslModeRequire";
import * as schema from "./schema";

/**
 * Real Drizzle instance (not a Proxy): `@auth/drizzle-adapter` uses `drizzle-orm`'s `is(db, PgDatabase)`,
 * which fails on a Proxy.
 *
 * When `DATABASE_URL` is unset (e.g. `next build` without `.env`), use a placeholder DSN so the client
 * is still a valid `PgDatabase`. `postgres` connects lazily on first query; static pages that skip DB
 * still build. Set `DATABASE_URL` for any route that runs SQL.
 *
 * Note: This module reads env when Node first loads it (e.g. serverless cold start). Vercel injects env
 * before the worker runs, so `process.env.DATABASE_URL` is available here—wrapping reads in a function
 * only helps if that function runs later than this module's top level, which `export const db = …`
 * does not do.
 */
const PLACEHOLDER =
  "postgresql://127.0.0.1:5432/workflow_verifier_build_placeholder";

function resolveConnectionString(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) {
    if (
      process.env.NODE_ENV === "production" &&
      (raw.includes("127.0.0.1") || raw.includes("localhost"))
    ) {
      console.error(
        "[db] DATABASE_URL points at localhost in production; use a hosted Postgres URL on Vercel.",
      );
    }
    return ensureSslModeRequire(raw);
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[db] DATABASE_URL missing or empty; using placeholder DSN (DB calls will fail).",
    );
  }
  return PLACEHOLDER;
}

const connectionString = resolveConnectionString();
assertCoreDatabaseBoundary(connectionString);

const client = postgres(connectionString, { max: 10 });
export const db: PostgresJsDatabase<typeof schema> = drizzle(client, { schema });
