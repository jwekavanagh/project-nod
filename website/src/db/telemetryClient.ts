import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ensureSslModeRequire } from "@/db/ensureSslModeRequire";
import * as telemetrySchema from "@/db/telemetrySchema";

const PLACEHOLDER =
  "postgresql://127.0.0.1:5432/agentskeptic_telemetry_build_placeholder";

function resolveTelemetryConnectionString(): string {
  const raw = process.env.TELEMETRY_DATABASE_URL?.trim();
  if (raw) {
    return ensureSslModeRequire(raw);
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[dbTelemetry] TELEMETRY_DATABASE_URL missing or empty; using placeholder DSN (telemetry SQL will fail).",
    );
  }
  return PLACEHOLDER;
}

const connectionString = resolveTelemetryConnectionString();
const client = postgres(connectionString, { max: 10 });
export const dbTelemetry: PostgresJsDatabase<typeof telemetrySchema> = drizzle(client, {
  schema: telemetrySchema,
});
