import { mergeAgentskepticUserConfig, readAgentskepticUserConfigRecord } from "./cliInstallId.js";

/**
 * Product-activation / OSS claim-ticket telemetry consent (OSS + commercial CLI).
 * Precedence: AGENTSKEPTIC_TELEMETRY=1 → on; =0 → off; any other non-empty env → off;
 * else persisted `telemetry` boolean in ~/.agentskeptic/config.json; else off.
 */
export function isProductActivationTelemetryEnabled(): boolean {
  const rawEnv = process.env.AGENTSKEPTIC_TELEMETRY?.trim();
  if (rawEnv === "1") return true;
  if (rawEnv === "0") return false;
  if (rawEnv !== undefined && rawEnv !== "") return false;

  const persisted = readPersistedTelemetryBoolean();
  if (persisted === true) return true;
  if (persisted === false) return false;
  return false;
}

/** `true` / `false` when the config file contains a boolean `telemetry` key; `null` if absent or unreadable. */
export function readPersistedTelemetryBoolean(): boolean | null {
  const rec = readAgentskepticUserConfigRecord();
  if (rec === null) return null;
  if (!Object.prototype.hasOwnProperty.call(rec, "telemetry")) return null;
  const v = rec["telemetry"];
  if (typeof v === "boolean") return v;
  return null;
}

export function hasPersistedTelemetryPreference(): boolean {
  return readPersistedTelemetryBoolean() !== null;
}

export function tryPersistTelemetryPreference(enabled: boolean): boolean {
  return mergeAgentskepticUserConfig({ telemetry: enabled });
}
