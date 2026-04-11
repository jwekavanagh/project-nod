import { z } from "zod";
import { loadSchemaValidator } from "agentskeptic";
import { DEMO_SCENARIO_IDS, type DemoScenarioId } from "./demoScenarioIds";

export { DEMO_SCENARIO_IDS, type DemoScenarioId };

export const demoVerifyRequestSchema = z.object({
  scenarioId: z.enum(DEMO_SCENARIO_IDS),
});

export type DemoVerifyRequest = z.infer<typeof demoVerifyRequestSchema>;

const validateWorkflowResult = loadSchemaValidator("workflow-result");

function workflowResultRefines(data: unknown): boolean {
  return validateWorkflowResult(data) === true;
}

export const demoVerifySuccessResponseSchema = z.object({
  ok: z.literal(true),
  scenarioId: z.enum(DEMO_SCENARIO_IDS),
  workflowResult: z.unknown().refine(workflowResultRefines, {
    message: "workflowResult failed workflow-result JSON Schema",
  }),
  truthReportText: z.string().min(1),
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
  ENGINE_FAILED: "DEMO_ENGINE_FAILED",
  RESULT_SCHEMA_MISMATCH: "DEMO_RESULT_SCHEMA_MISMATCH",
} as const;
