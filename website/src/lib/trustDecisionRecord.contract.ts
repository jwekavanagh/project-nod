import { z } from "zod";

const firstProblemSchema = z
  .object({
    seq: z.number().int().min(0),
    tool_id: z.string(),
    observed_trunc: z.string().max(512),
    expected_trunc: z.string().max(512),
  })
  .strict();

const snapshotSchema = z
  .object({
    schema_version: z.literal(1),
    workflow_id: z.string().min(1).max(512),
    run_kind: z.enum(["contract_sql", "contract_sql_langgraph_checkpoint_trust", "quick_preview"]),
    state_relation: z.enum(["matches_expectations", "does_not_match", "not_established"]),
    high_stakes_reliance: z.enum(["permitted", "prohibited"]),
    reason_codes: z.array(z.string().min(1).max(256)).max(24),
    first_problem: z.union([firstProblemSchema, z.null()]),
  })
  .strict();

/** Ingest body for **`POST /api/v1/funnel/trust-decision-blocked`**. */
export const trustDecisionRecordIngestSchema = z
  .object({
    schema_version: z.literal(1),
    trust_decision: z.enum(["safe", "unsafe", "unknown"]),
    gate_kind: z.enum(["contract_sql_irreversible", "langgraph_checkpoint_terminal"]),
    routing: z
      .object({
        routing_key: z.string().min(1).max(512),
        team: z.string().max(256).optional(),
        owner_slug: z.string().max(256).optional(),
      })
      .strict(),
    certificate_snapshot: snapshotSchema,
    human_blocker_lines: z.array(z.string().max(4096)).length(6),
  })
  .strict();

export type TrustDecisionRecordIngest = z.infer<typeof trustDecisionRecordIngestSchema>;
