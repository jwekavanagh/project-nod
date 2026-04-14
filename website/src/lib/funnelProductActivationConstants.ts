/** Max UTF-8 body size for POST /api/funnel/product-activation. */
export const PRODUCT_ACTIVATION_MAX_BODY_BYTES = 4096;

/** Max |now - issued_at| for activation telemetry (same window as usage reserve skew). */
export const PRODUCT_ACTIVATION_MAX_ISSUED_AT_SKEW_MS = 300_000;

export const PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER = "X-AgentSkeptic-Product";
export const PRODUCT_ACTIVATION_CLI_VERSION_HEADER = "X-AgentSkeptic-Cli-Version";
export const PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE = "cli";
