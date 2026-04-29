import { FUNNEL_EVENT_NAMES, type FunnelEventName } from "@/lib/funnelEvents";

/** Funnel rows stored in the telemetry Postgres (`TELEMETRY_DATABASE_URL`) after cutover. */
export const TELEMETRY_TIER_FUNNEL_EVENTS = [
  "demo_verify_ok",
  "acquisition_landed",
  "integrate_landed",
  "verify_started",
  "verify_outcome",
] as const satisfies readonly FunnelEventName[];

/** Funnel rows that remain on the core commercial Postgres (`DATABASE_URL`). */
export const CORE_TIER_FUNNEL_EVENTS = [
  "sign_in",
  "checkout_started",
  "subscription_checkout_completed",
  "api_key_created",
  "api_key_revoked",
  "api_key_rotated",
  "api_key_scope_denied",
  "api_key_last_used_write_failed",
  "reserve_allowed",
  "report_share_created",
  "report_share_view",
  "licensed_verify_outcome",
  "trust_decision_blocked",
  "oss_claim_redeemed",
] as const satisfies readonly FunnelEventName[];

const TELEMETRY_SET = new Set<string>(TELEMETRY_TIER_FUNNEL_EVENTS);
const CORE_SET = new Set<string>(CORE_TIER_FUNNEL_EVENTS);

export function isTelemetryTierFunnelEvent(event: FunnelEventName): boolean {
  return TELEMETRY_SET.has(event);
}

export function isCoreTierFunnelEvent(event: FunnelEventName): boolean {
  return CORE_SET.has(event);
}

/** Dev/test guard: every enum member appears in exactly one tier. */
export function assertFunnelEventTierPartition(): void {
  for (const name of FUNNEL_EVENT_NAMES) {
    const t = TELEMETRY_SET.has(name);
    const c = CORE_SET.has(name);
    if (t === c) {
      throw new Error(`funnelEventTier: invalid partition for "${name}" (telemetry=${t} core=${c})`);
    }
  }
}
