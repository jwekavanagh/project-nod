/**
 * Globs for Next `outputFileTracingIncludes["/api/demo/verify"]`, relative to the website package
 * root (same directory as `next.config.ts`).
 *
 * The demo route loads `agentskeptic` JSON Schemas and `examples/*` via runtime paths that file
 * tracing cannot infer; these entries must stay aligned with the repo layout.
 */
export const DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS = [
  "../schemas/**/*.schema.json",
  "../examples/events.ndjson",
  "../examples/tools.json",
  "../examples/seed.sql",
] as const;
