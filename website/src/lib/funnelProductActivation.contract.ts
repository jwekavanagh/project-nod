import { z } from "zod";

const issuedAtSchema = z.string().min(1).max(64);

const workloadClassSchema = z.enum(["bundled_examples", "non_bundled"]);
const subcommandSchema = z.enum(["batch_verify", "quick_verify"]);
const buildProfileSchema = z.enum(["oss", "commercial"]);
const terminalStatusSchema = z.enum(["complete", "inconsistent", "incomplete"]);

const cliVersionSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+._a-zA-Z0-9]*)?$/);

export const productActivationVerifyStartedSchema = z.object({
  event: z.literal("verify_started"),
  schema_version: z.literal(1),
  run_id: z.string().min(1).max(256),
  issued_at: issuedAtSchema,
  workload_class: workloadClassSchema,
  subcommand: subcommandSchema,
  build_profile: buildProfileSchema,
});

export const productActivationVerifyOutcomeSchema = z.object({
  event: z.literal("verify_outcome"),
  schema_version: z.literal(1),
  run_id: z.string().min(1).max(256),
  issued_at: issuedAtSchema,
  workload_class: workloadClassSchema,
  subcommand: subcommandSchema,
  build_profile: buildProfileSchema,
  terminal_status: terminalStatusSchema,
});

export const productActivationRequestSchema = z.discriminatedUnion("event", [
  productActivationVerifyStartedSchema,
  productActivationVerifyOutcomeSchema,
]);

export type ProductActivationRequest = z.infer<typeof productActivationRequestSchema>;

export { cliVersionSchema };
