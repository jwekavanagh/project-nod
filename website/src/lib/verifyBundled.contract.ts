import { z } from "zod";

export const verifyBundledSuccessResponseClientSchema = z.object({
  ok: z.literal(true),
  workflowId: z.string().min(1),
  certificate: z.unknown(),
  humanReport: z.string().min(1),
});

/** Shared success contract for both `/api/verify` and `/api/demo/verify`. */
export const verifyBundledSuccessResponseSchema = verifyBundledSuccessResponseClientSchema;

export type VerifyBundledSuccessResponse = z.infer<typeof verifyBundledSuccessResponseSchema>;

export const verifyBundledErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export type VerifyBundledErrorResponse = z.infer<typeof verifyBundledErrorResponseSchema>;

export const VERIFY_BUNDLED_ERROR_CODES = {
  METHOD_NOT_ALLOWED: "VERIFY_METHOD_NOT_ALLOWED",
  UNSUPPORTED_MEDIA_TYPE: "VERIFY_UNSUPPORTED_MEDIA_TYPE",
  INVALID_JSON: "VERIFY_INVALID_JSON",
  VALIDATION_FAILED: "VERIFY_VALIDATION_FAILED",
  FIXTURES_MISSING: "VERIFY_FIXTURES_MISSING",
  UNAVAILABLE: "VERIFY_UNAVAILABLE",
  ENGINE_FAILED: "VERIFY_ENGINE_FAILED",
  RESULT_SCHEMA_MISMATCH: "VERIFY_RESULT_SCHEMA_MISMATCH",
} as const;
