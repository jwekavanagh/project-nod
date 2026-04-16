import { assertDestructivePostgresUrlsOrThrow } from "../../../scripts/assert-destructive-postgres-urls.mjs";

/**
 * Call before integration SQL that TRUNCATEs shared commercial / telemetry tables.
 * Every non-empty URL among DATABASE_URL and TELEMETRY_DATABASE_URL must be loopback
 * (fail-closed for mixed local + remote).
 */
export function assertPostgresUrlsSafeForTruncate(tool: string): void {
  assertDestructivePostgresUrlsOrThrow(
    [
      { name: "DATABASE_URL", raw: process.env.DATABASE_URL },
      { name: "TELEMETRY_DATABASE_URL", raw: process.env.TELEMETRY_DATABASE_URL },
    ],
    { tool },
  );
}
