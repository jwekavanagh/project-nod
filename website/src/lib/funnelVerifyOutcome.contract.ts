import { z } from "zod";
import { evidenceGapPrimarySchema } from "./evidenceGapPrimaryZod";

const activationStageSchema = z.object({
  id: z.enum(["ingest_input", "provisional_infer", "contract_verify", "proof_export"]),
  status: z.enum(["complete", "failed", "skipped"]),
  trust_label: z.enum([
    "n_a",
    "provisional_pass",
    "decision_ready",
    "contract_inconsistent",
    "contract_incomplete",
  ]),
});

const activationWireSchema = z.object({
  trust_terminal: z.enum(["decision_ready", "contract_inconsistent", "contract_incomplete"]),
  stages: z.array(activationStageSchema).length(4),
});

export const verifyOutcomeRequestSchema = z
  .object({
    schema_version: z.literal(3),
    run_id: z.string().min(1).max(256),
    workflow_id: z.string().min(1).max(512),
    trust_decision: z.enum(["safe", "unsafe", "unknown"]),
    evidence_gap_primary: evidenceGapPrimarySchema,
    reason_codes: z
      .array(z.string().min(1).max(64))
      .max(8)
      .transform((arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b))),
    terminal_status: z.enum(["complete", "inconsistent", "incomplete"]),
    workload_class: z.enum(["bundled_examples", "non_bundled"]),
    subcommand: z.enum(["batch_verify", "quick_verify", "verify_integrator_owned", "activate"]),
    activation: activationWireSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.subcommand === "activate") {
      if (data.activation === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "activation is required when subcommand is activate",
          path: ["activation"],
        });
      }
      return;
    }
    if (data.activation !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "activation must not appear unless subcommand is activate",
        path: ["activation"],
      });
    }
  });

export type VerifyOutcomeRequest = z.infer<typeof verifyOutcomeRequestSchema>;
