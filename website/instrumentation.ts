import { assertCoreDatabaseBoundary } from "@/lib/coreDatabaseBoundary";
import { assertProductionCommercialGuards } from "@/lib/assertProductionCommercialGuards";
import { isProductionLike } from "@/lib/canonicalSiteOrigin";
import { ensureSslModeRequire } from "@/db/ensureSslModeRequire";

export const TELEMETRY_DATABASE_URL_REQUIRED_MESSAGE =
  "AGENTSKEPTIC_TELEMETRY_DATABASE_URL_REQUIRED: TELEMETRY_DATABASE_URL must be set when VERCEL_ENV=production (see docs/telemetry-storage-ssot.md)";

function assertProductionTelemetryDatabaseConfigured(): void {
  if (!isProductionLike()) {
    return;
  }
  if (!process.env.TELEMETRY_DATABASE_URL?.trim()) {
    throw new Error(TELEMETRY_DATABASE_URL_REQUIRED_MESSAGE);
  }
}

export function register(): void {
  assertProductionCommercialGuards();
  assertProductionTelemetryDatabaseConfigured();
  const raw = process.env.DATABASE_URL?.trim();
  if (raw) {
    assertCoreDatabaseBoundary(ensureSslModeRequire(raw));
  }
}
