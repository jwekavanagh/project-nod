/**
 * Globs for Next `outputFileTracingIncludes["/api/integrator/registry-draft"]` (see `next.config.ts`).
 * The DraftEngine validates against JSON Schemas from the OSS package tree (`agentskeptic` workspace).
 */
export const REGISTRY_DRAFT_API_FILE_TRACING_GLOBS = ["../schemas/**/*.schema.json"] as const;
