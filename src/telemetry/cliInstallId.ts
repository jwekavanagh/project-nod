import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

let cachedEphemeralInstallId: string | null = null;

function configPath(): string {
  return join(homedir(), ".agentskeptic", "config.json");
}

/** Full JSON object from ~/.agentskeptic/config.json; preserves unknown keys for merge writes. */
export function readAgentskepticUserConfigRecord(): Record<string, unknown> | null {
  const filePath = configPath();
  if (!existsSync(filePath)) return null;
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  if (raw.trim() === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return { ...(parsed as Record<string, unknown>) };
}

/** Shallow-merge keys into ~/.agentskeptic/config.json (creates parent dirs). Unknown keys are preserved. */
export function mergeAgentskepticUserConfig(partial: Record<string, unknown>): boolean {
  const filePath = configPath();
  const prior = readAgentskepticUserConfigRecord() ?? {};
  const next = { ...prior, ...partial };
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(next), "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Matches Zod `z.string().uuid()` acceptance for persisted ids. */
export function isPersistedConfigUuid(s: string): boolean {
  const t = s.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
}

type AgentskepticConfigFile = {
  install_id?: string;
  funnel_anon_id?: string;
};

function tryWriteConfigMerge(partial: AgentskepticConfigFile): boolean {
  const patch: Record<string, unknown> = {};
  if (partial.install_id !== undefined) patch.install_id = partial.install_id;
  if (partial.funnel_anon_id !== undefined) patch.funnel_anon_id = partial.funnel_anon_id;
  if (Object.keys(patch).length === 0) return true;
  return mergeAgentskepticUserConfig(patch);
}

function tryReadValidInstallIdFromDisk(): string | null {
  const obj = readAgentskepticUserConfigRecord();
  if (!obj) return null;
  const id = obj.install_id;
  if (typeof id !== "string" || !isPersistedConfigUuid(id)) return null;
  return id.trim();
}

function tryPersistInstallId(installId: string): boolean {
  return tryWriteConfigMerge({ install_id: installId });
}

/**
 * Read persisted funnel anonymous id for product-activation telemetry (disk).
 * Returns undefined when missing or invalid.
 */
export function getPersistedFunnelAnonIdForTelemetry(): string | undefined {
  const obj = readAgentskepticUserConfigRecord();
  if (!obj) return undefined;
  const id = obj.funnel_anon_id;
  if (typeof id !== "string" || !isPersistedConfigUuid(id)) return undefined;
  return id.trim();
}

/**
 * Persist funnel_anon_id beside install_id (merge). Validates UUID.
 * @returns false when uuid invalid or write failed
 */
export function tryPersistFunnelAnonId(uuid: string): boolean {
  const t = uuid.trim();
  if (!isPersistedConfigUuid(t)) return false;
  return tryWriteConfigMerge({ funnel_anon_id: t });
}

/**
 * Stable pseudonymous id for this CLI environment (best-effort disk, else process singleton).
 * Never throws. Must not be called when telemetry is disabled.
 */
export function getOrCreateInstallId(): string {
  if (cachedEphemeralInstallId) return cachedEphemeralInstallId;

  const fromDisk = tryReadValidInstallIdFromDisk();
  if (fromDisk) return fromDisk;

  const newId = randomUUID();
  if (tryPersistInstallId(newId)) {
    return newId;
  }

  cachedEphemeralInstallId = newId;
  return newId;
}

/** Clears in-process fallback state (node:test / Vitest only). */
export function resetCliInstallIdModuleStateForTests(): void {
  cachedEphemeralInstallId = null;
}
