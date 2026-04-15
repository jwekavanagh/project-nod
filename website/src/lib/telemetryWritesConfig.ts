/**
 * When `1`, telemetry-tier funnel rows from `logFunnelEvent` (default path) are written to
 * `TELEMETRY_DATABASE_URL`. Product-activation always writes beacons + funnel on the telemetry DB
 * when `TELEMETRY_DATABASE_URL` is set (see docs/telemetry-storage-ssot.md).
 */
export function telemetryTierWritesUseTelemetryDatabase(): boolean {
  return process.env.AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB === "1";
}

export function telemetryCoreWriteFreezeActive(): boolean {
  return process.env.AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE === "1";
}
