import { emitDeprecationOnce } from "./deprecate.js";
import { createDecisionGateImpl, type CreateDecisionGateOptions, type DecisionGate } from "../decisionGate.js";
import { verifyWorkflow as verifyWorkflowInner } from "../pipeline.js";
import { verifyAgentskepticImpl } from "../verifyAgentskeptic.js";
import {
  runQuickVerify as runQuickVerifyInner,
  runQuickVerifyToValidatedReport as runQuickVerifyToValidatedReportInner,
} from "../quickVerify/runQuickVerify.js";
import type { RunQuickVerifyOptions, RunQuickVerifyResult } from "../quickVerify/runQuickVerify.js";
import {
  assertLangGraphCheckpointProductionGate as assertLangGraphCheckpointProductionGateInner,
  createLangGraphCheckpointTrustGate as createLangGraphCheckpointTrustGateInner,
} from "../langGraphCheckpointTrustGate.js";
import type { CreateLangGraphCheckpointTrustGateOptions, LangGraphCheckpointTrustGate } from "../langGraphCheckpointTrustGate.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import type { WorkflowResult } from "../types.js";

const MIGRATE = "See docs/migrate-2.md and the `AgentSkeptic` class (AgentSkeptic v2).";

export function createDecisionGate(options: CreateDecisionGateOptions): DecisionGate {
  emitDeprecationOnce("createDecisionGate", MIGRATE);
  return createDecisionGateImpl(options);
}

export async function verifyWorkflow(
  options: Parameters<typeof verifyWorkflowInner>[0],
): Promise<WorkflowResult> {
  emitDeprecationOnce("verifyWorkflow", MIGRATE);
  return verifyWorkflowInner(options);
}

export async function verifyAgentskeptic(options: {
  workflowId: string;
  databaseUrl: string;
  projectRoot?: string;
}): Promise<OutcomeCertificateV1> {
  emitDeprecationOnce("verifyAgentskeptic", MIGRATE);
  return verifyAgentskepticImpl(options);
}

export async function runQuickVerify(opts: RunQuickVerifyOptions): Promise<RunQuickVerifyResult> {
  emitDeprecationOnce("runQuickVerify", MIGRATE);
  return runQuickVerifyInner(opts);
}

export async function runQuickVerifyToValidatedReport(opts: RunQuickVerifyOptions): Promise<RunQuickVerifyResult> {
  emitDeprecationOnce("runQuickVerifyToValidatedReport", MIGRATE);
  return runQuickVerifyToValidatedReportInner(opts);
}

export async function assertLangGraphCheckpointProductionGate(certificate: OutcomeCertificateV1): Promise<void> {
  emitDeprecationOnce("assertLangGraphCheckpointProductionGate", MIGRATE);
  await assertLangGraphCheckpointProductionGateInner(certificate);
}

export function createLangGraphCheckpointTrustGate(
  options: CreateLangGraphCheckpointTrustGateOptions,
): LangGraphCheckpointTrustGate {
  emitDeprecationOnce("createLangGraphCheckpointTrustGate", MIGRATE);
  return createLangGraphCheckpointTrustGateInner(options);
}
