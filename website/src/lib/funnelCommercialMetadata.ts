import { z } from "zod";

import { evidenceGapPrimarySchema } from "./evidenceGapPrimaryZod";

const reserveIntentSchema = z.enum(["verify", "enforce"]);

export const reserveAllowedMetadataSchema = z.object({
  schema_version: z.literal(1),
  intent: reserveIntentSchema,
});

export const checkoutStartedMetadataSchema = z.object({
  schema_version: z.literal(1),
  plan: z.enum(["individual", "team", "business"]),
  post_activation: z.boolean(),
});

export type ReserveAllowedMetadata = z.infer<typeof reserveAllowedMetadataSchema>;
export type CheckoutStartedMetadata = z.infer<typeof checkoutStartedMetadataSchema>;

export function buildReserveAllowedMetadata(intent: "verify" | "enforce"): ReserveAllowedMetadata {
  return reserveAllowedMetadataSchema.parse({ schema_version: 1, intent });
}

export function buildCheckoutStartedMetadata(
  plan: "individual" | "team" | "business",
  postActivation: boolean,
): CheckoutStartedMetadata {
  return checkoutStartedMetadataSchema.parse({
    schema_version: 1,
    plan,
    post_activation: postActivation,
  });
}

const verifyOutcomeLicensedBaseSchema = z.object({
  terminal_status: z.enum(["complete", "inconsistent", "incomplete"]),
  workload_class: z.enum(["bundled_examples", "non_bundled"]),
  workflow_id: z.string().max(512),
  trust_decision: z.enum(["safe", "unsafe", "unknown"]),
  reason_codes: z.array(z.string()),
  evidence_gap_primary: evidenceGapPrimarySchema,
});

const licensedVerifyOutcomeActivationSchema = z.object({
  trust_terminal: z.enum(["decision_ready", "contract_inconsistent", "contract_incomplete"]),
  stages: z
    .array(
      z.object({
        id: z.enum(["ingest_input", "provisional_infer", "contract_verify", "proof_export"]),
        status: z.enum(["complete", "failed", "skipped"]),
        trust_label: z.enum([
          "n_a",
          "provisional_pass",
          "decision_ready",
          "contract_inconsistent",
          "contract_incomplete",
        ]),
      }),
    )
    .length(4),
});

export const licensedVerifyOutcomeMetadataSchema = z.discriminatedUnion("schema_version", [
  verifyOutcomeLicensedBaseSchema.extend({
    schema_version: z.literal(4),
    subcommand: z.enum(["batch_verify", "quick_verify", "verify_integrator_owned"]),
  }),
  verifyOutcomeLicensedBaseSchema.extend({
    schema_version: z.literal(5),
    subcommand: z.literal("activate"),
    activation: licensedVerifyOutcomeActivationSchema,
  }),
]);

export type LicensedVerifyOutcomeMetadata = z.infer<typeof licensedVerifyOutcomeMetadataSchema>;

export function buildLicensedVerifyOutcomeMetadata(
  input:
    | (z.infer<typeof verifyOutcomeLicensedBaseSchema> & {
        subcommand: "batch_verify" | "quick_verify" | "verify_integrator_owned";
      })
    | (z.infer<typeof verifyOutcomeLicensedBaseSchema> & {
        subcommand: "activate";
        activation: z.infer<typeof licensedVerifyOutcomeActivationSchema>;
      }),
): LicensedVerifyOutcomeMetadata {
  if (input.subcommand === "activate") {
    return licensedVerifyOutcomeMetadataSchema.parse({
      schema_version: 5,
      terminal_status: input.terminal_status,
      workload_class: input.workload_class,
      subcommand: "activate",
      workflow_id: input.workflow_id,
      trust_decision: input.trust_decision,
      reason_codes: input.reason_codes,
      evidence_gap_primary: input.evidence_gap_primary,
      activation: input.activation,
    });
  }
  return licensedVerifyOutcomeMetadataSchema.parse({
    schema_version: 4,
    terminal_status: input.terminal_status,
    workload_class: input.workload_class,
    subcommand: input.subcommand,
    workflow_id: input.workflow_id,
    trust_decision: input.trust_decision,
    reason_codes: input.reason_codes,
    evidence_gap_primary: input.evidence_gap_primary,
  });
}
