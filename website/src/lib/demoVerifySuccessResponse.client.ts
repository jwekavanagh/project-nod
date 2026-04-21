import { z } from "zod";
import { DEMO_SCENARIO_IDS } from "./demoScenarioIds";

/**
 * Client-safe success body for POST /api/demo/verify (no JSON Schema / fs).
 * Field names and literals must stay aligned with `demoVerifySuccessResponseSchema` in `demoVerify.contract.ts`.
 */
export const demoVerifySuccessResponseSchema = z.object({
  ok: z.literal(true),
  scenarioId: z.enum(DEMO_SCENARIO_IDS),
  certificate: z.unknown(),
  humanReport: z.string().min(1),
});

export type DemoVerifySuccessResponseClient = z.infer<typeof demoVerifySuccessResponseSchema>;
