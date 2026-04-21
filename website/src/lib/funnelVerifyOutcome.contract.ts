import { z } from "zod";

export const verifyOutcomeRequestSchema = z.object({
  schema_version: z.literal(2),
  run_id: z.string().min(1).max(256),
  workflow_id: z.string().min(1).max(512),
  trust_decision: z.enum(["safe", "unsafe", "unknown"]),
  reason_codes: z
    .array(z.string().min(1).max(64))
    .max(8)
    .transform((arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b))),
  terminal_status: z.enum(["complete", "inconsistent", "incomplete"]),
  workload_class: z.enum(["bundled_examples", "non_bundled"]),
  subcommand: z.enum(["batch_verify", "quick_verify", "verify_integrator_owned"]),
});

export type VerifyOutcomeRequest = z.infer<typeof verifyOutcomeRequestSchema>;
