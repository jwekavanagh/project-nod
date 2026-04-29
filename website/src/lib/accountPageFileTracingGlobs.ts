/**
 * Globs for Next `outputFileTracingIncludes["/account"]` (see `next.config.ts`).
 *
 * The account route calls `assembleCommercialAccountState()` → `loadCommercialPlans()`, which reads
 * `config/commercial-plans.json` via runtime `readFileSync` paths that Node file tracing does not infer.
 * Without explicit includes, serverless deployments can omit that file and the page returns HTTP 500
 * (“This page couldn’t load”) for signed-in visitors.
 *
 * Paths are relative to the website package root (same directory as `next.config.ts`).
 */
export const ACCOUNT_PAGE_OUTPUT_FILE_TRACING_GLOBS = ["../config/commercial-plans.json"] as const;
