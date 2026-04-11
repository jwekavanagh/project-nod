/** Stable `error` field for `POST /api/account/billing-portal` when `user.stripe_customer_id` is missing. */
export const STRIPE_CUSTOMER_MISSING_ERROR = "STRIPE_CUSTOMER_MISSING" as const;

/** Stable human-readable message (same in API 404 body and client fallback). */
export const STRIPE_CUSTOMER_MISSING_MESSAGE =
  "Complete a subscription checkout once to create your billing profile, or contact the site operator.";
