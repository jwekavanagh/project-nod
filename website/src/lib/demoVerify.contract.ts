import { z } from "zod";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import { demoVerifySuccessResponseSchema as demoVerifySuccessResponseShape } from "./demoVerifySuccessResponse.client";
import { DEMO_SCENARIO_IDS, type DemoScenarioId } from "./demoScenarios";
import { DEMO_ERROR_CODES } from "./demoVerifyErrorCodes";

export { DEMO_ERROR_CODES, DEMO_SCENARIO_IDS, type DemoScenarioId };

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
