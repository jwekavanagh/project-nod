import { z } from "zod";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import { demoVerifySuccessResponseSchema as demoVerifySuccessResponseShape } from "./demoVerifySuccessResponse.client";
import { DEMO_SCENARIO_IDS, type DemoScenarioId } from "./demoScenarioIds";

export { DEMO_SCENARIO_IDS, type DemoScenarioId };

export const demoVerifyRequestSchema = z.object({
  scenarioId: z.enum(DEMO_SCENARIO_IDS),
});

export type DemoVerifyRequest = z.infer<typeof demoVerifyRequestSchema>;

const validateOutcomeCertificate = loadSchemaValidator("outcome-certificate-v1");

function outcomeCertificateRefines(data: unknown): boolean {
  return validateOutcomeCertificate(data) === true;
}

/** Server / tests: same shape as the client schema plus Outcome Certificate JSON Schema validation. */
export const demoVerifySuccessResponseSchema = demoVerifySuccessResponseShape.extend({
  certificate: z.unknown().refine(outcomeCertificateRefines, {
    message: "certificate failed outcome-certificate-v1 JSON Schema",
  }),
});

export type DemoVerifySuccessResponse = z.infer<typeof demoVerifySuccessResponseSchema>;

export const demoVerifyErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export type DemoVerifyErrorResponse = z.infer<typeof demoVerifyErrorResponseSchema>;

export const DEMO_ERROR_CODES = {
  METHOD_NOT_ALLOWED: "DEMO_METHOD_NOT_ALLOWED",
  UNSUPPORTED_MEDIA_TYPE: "DEMO_UNSUPPORTED_MEDIA_TYPE",
  INVALID_JSON: "DEMO_INVALID_JSON",
  VALIDATION_FAILED: "DEMO_VALIDATION_FAILED",
  FIXTURES_MISSING: "DEMO_FIXTURES_MISSING",
  /** Temporary maintenance (telemetry write freeze). */
  UNAVAILABLE: "DEMO_UNAVAILABLE",
  ENGINE_FAILED: "DEMO_ENGINE_FAILED",
  RESULT_SCHEMA_MISMATCH: "DEMO_RESULT_SCHEMA_MISMATCH",
} as const;
