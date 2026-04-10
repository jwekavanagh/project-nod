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
