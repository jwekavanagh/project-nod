import { z } from "zod";
import { DEMO_SCENARIO_IDS, type DemoScenarioId } from "./demoScenarios";
import { DEMO_ERROR_CODES } from "./demoVerifyErrorCodes";
import {
  verifyBundledSuccessResponseSchema as demoVerifySuccessResponseSchema,
  type VerifyBundledSuccessResponse as DemoVerifySuccessResponse,
} from "./verifyBundled.contract";

export { DEMO_ERROR_CODES, DEMO_SCENARIO_IDS, type DemoScenarioId };
export { demoVerifySuccessResponseSchema, type DemoVerifySuccessResponse };

export const demoVerifyRequestSchema = z.object({
  scenarioId: z.enum(DEMO_SCENARIO_IDS),
});

export type DemoVerifyRequest = z.infer<typeof demoVerifyRequestSchema>;

export const demoVerifyErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export type DemoVerifyErrorResponse = z.infer<typeof demoVerifyErrorResponseSchema>;
