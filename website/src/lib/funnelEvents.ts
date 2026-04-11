export const FUNNEL_EVENT_NAMES = [
  "demo_verify_ok",
  "sign_in",
  "checkout_started",
  "subscription_checkout_completed",
  "api_key_created",
  "reserve_allowed",
  "report_share_created",
  "report_share_view",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENT_NAMES)[number];
