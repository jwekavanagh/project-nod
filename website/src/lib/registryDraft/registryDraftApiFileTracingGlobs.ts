/**
 * Globs for Next `outputFileTracingIncludes["/api/integrator/registry-draft"]` (see `next.config.ts`).
 * The route loads `agentskeptic/registryDraft`, which reads JSON Schemas from the repo `schemas/` tree.
 */
export const REGISTRY_DRAFT_API_FILE_TRACING_GLOBS = ["../schemas/**/*.schema.json"] as const;
