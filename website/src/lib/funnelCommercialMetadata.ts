import { z } from "zod";

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

export const licensedVerifyOutcomeMetadataSchema = z.object({
  schema_version: z.literal(2),
  terminal_status: z.enum(["complete", "inconsistent", "incomplete"]),
  workload_class: z.enum(["bundled_examples", "non_bundled"]),
  subcommand: z.enum(["batch_verify", "quick_verify", "verify_integrator_owned"]),
  workflow_id: z.string().max(512),
  trust_decision: z.enum(["safe", "unsafe", "unknown"]),
  reason_codes: z.array(z.string()),
});

export type LicensedVerifyOutcomeMetadata = z.infer<typeof licensedVerifyOutcomeMetadataSchema>;

export function buildLicensedVerifyOutcomeMetadata(input: {
  terminal_status: "complete" | "inconsistent" | "incomplete";
  workload_class: "bundled_examples" | "non_bundled";
  subcommand: "batch_verify" | "quick_verify" | "verify_integrator_owned";
  workflow_id: string;
  trust_decision: "safe" | "unsafe" | "unknown";
  reason_codes: string[];
}): LicensedVerifyOutcomeMetadata {
  return licensedVerifyOutcomeMetadataSchema.parse({
    schema_version: 2,
    terminal_status: input.terminal_status,
    workload_class: input.workload_class,
    subcommand: input.subcommand,
    workflow_id: input.workflow_id,
    trust_decision: input.trust_decision,
    reason_codes: input.reason_codes,
  });
}
