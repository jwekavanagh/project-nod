export const FUNNEL_EVENT_NAMES = [
  "demo_verify_ok",
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
  "acquisition_landed",
  "integrate_landed",
  "licensed_verify_outcome",
  "trust_decision_blocked",
  "verify_started",
  "verify_outcome",
  "oss_claim_redeemed",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number];
