import path from "node:path";
import { CLI_OPERATIONAL_CODES, runLevelIssue } from "./failureCatalog.js";
import { finalizeIrreversibleBlockThrow } from "./finalizeIrreversibleTrustBlock.js";
import { isToolObservedRunEvent } from "./executionTrace.js";
import { validatedLangGraphIneligibleCertificate } from "./langGraphCheckpointTrustIneligibleCertificate.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { resolveVerificationPolicyInput } from "./verificationPolicy.js";
import { TruthLayerError } from "./truthLayerError.js";
import { trustDecisionFromCertificate } from "./trustDecision.js";
import type { Reason, RunEvent, ToolObservedEvent, VerificationDatabase, VerificationPolicy } from "./types.js";
import {
  buildOutcomeCertificateLangGraphCheckpointTrustFromWorkflowResult,
  type OutcomeCertificateV1,
} from "./outcomeCertificate.js";
import { verifyRunStateFromBufferedRunEvents } from "./verifyRunStateFromBufferedRunEvents.js";
import { parseVerificationDatabaseUrl } from "./verificationDatabaseUrl.js";

const validateEvent = loadSchemaValidator("event");

function verificationDatabaseFromUrl(databaseUrl: string, projectRoot: string): VerificationDatabase {
  return parseVerificationDatabaseUrl(databaseUrl, projectRoot);
}

export type LangGraphCheckpointTrustEligibility =
  | { eligible: true }
  | { eligible: false; certificateReasons: Reason[] };

/**
 * Shared eligibility for LangGraph checkpoint trust (CLI + runtime gate).
 * Preconditions: `toolObservedEvents` are schema-valid `tool_observed` for the target workflow only.
 */
export function classifyLangGraphCheckpointTrustEligibility(input: {
  runLevelReasons: Reason[];
  toolObservedEvents: ToolObservedEvent[];
}): LangGraphCheckpointTrustEligibility {
  if (input.runLevelReasons.length > 0) {
    return { eligible: false, certificateReasons: [...input.runLevelReasons] };
  }
  if (input.toolObservedEvents.length === 0) {
    return { eligible: false, certificateReasons: [runLevelIssue("NO_STEPS_FOR_WORKFLOW")] };
  }
  if (input.toolObservedEvents.some((t) => t.schemaVersion !== 3)) {
    return {
      eligible: false,
      certificateReasons: [runLevelIssue("LANGGRAPH_CHECKPOINT_TRUST_NON_V3_TOOL_OBSERVED")],
    };
  }
  return { eligible: true };
}

function lgRowBPasses(certificate: OutcomeCertificateV1): boolean {
  const verdicts = certificate.checkpointVerdicts;
  return (
    verdicts !== undefined &&
    verdicts.length > 0 &&
    verdicts.every((r) => r.verdict === "verified") &&
    certificate.stateRelation === "matches_expectations" &&
    certificate.highStakesReliance === "permitted" &&
    trustDecisionFromCertificate(certificate) === "safe"
  );
}

/**
 * LangGraph production wedge: succeeds only on terminal row **B** (matches + all checkpoint verdicts verified).
 */
export async function assertLangGraphCheckpointProductionGate(
  certificate: OutcomeCertificateV1,
  routingOpts?: { ownerRoutingKey?: string; routingTeam?: string; ownerSlug?: string },
): Promise<void> {
  if (certificate.runKind !== "contract_sql_langgraph_checkpoint_trust") {
    throw new Error(
      "assertLangGraphCheckpointProductionGate: certificate.runKind must be contract_sql_langgraph_checkpoint_trust",
    );
  }
  if (lgRowBPasses(certificate)) return;
  await finalizeIrreversibleBlockThrow({
    certificate,
    gateKind: "langgraph_checkpoint_terminal",
    routingOpts: {
      workflowIdFallback: certificate.workflowId,
      ownerRoutingKey: routingOpts?.ownerRoutingKey,
      routingTeam: routingOpts?.routingTeam,
      ownerSlug: routingOpts?.ownerSlug,
    },
  });
}

export type CreateLangGraphCheckpointTrustGateOptions = {
  workflowId: string;
  registryPath: string;
  databaseUrl: string;
  projectRoot?: string;
  verificationPolicy?: VerificationPolicy;
  logStep?: (line: object) => void;
  truthReport?: (report: string) => void;
  ownerRoutingKey?: string;
  routingTeam?: string;
  ownerSlug?: string;
};

export type LangGraphCheckpointTrustGate = {
  appendRunEvent(value: unknown): void;
  toNdjsonUtf8(): Buffer;
  /** Eligible path hits the DB; ineligible returns certificate only (no DB). */
  runCheckpointTrust(): Promise<OutcomeCertificateV1>;
  assertLangGraphCheckpointProductionGate(): Promise<void>;
};

export function createLangGraphCheckpointTrustGate(
  options: CreateLangGraphCheckpointTrustGateOptions,
): LangGraphCheckpointTrustGate {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const registryPath = path.resolve(projectRoot, options.registryPath);
  const verificationPolicy = resolveVerificationPolicyInput(options.verificationPolicy);
  const database = verificationDatabaseFromUrl(options.databaseUrl, projectRoot);
  const logStep = options.logStep ?? (() => {});
  const truthReport = options.truthReport ?? (() => {});

  const bufferedRunEvents: RunEvent[] = [];
  const runLevelReasons: Reason[] = [];

  const api = {} as LangGraphCheckpointTrustGate;

  api.appendRunEvent = (value: unknown): void => {
    if (typeof value !== "object" || value === null) {
      runLevelReasons.push(runLevelIssue("MALFORMED_EVENT_LINE"));
      return;
    }
    if (!validateEvent(value)) {
      runLevelReasons.push(runLevelIssue("MALFORMED_EVENT_LINE"));
      return;
    }
    const ev = value as RunEvent;
    if (ev.workflowId !== options.workflowId) {
      return;
    }
    bufferedRunEvents.push(ev);
  };

  api.toNdjsonUtf8 = (): Buffer => {
    const parts: string[] = [];
    for (const ev of bufferedRunEvents) {
      parts.push(`${JSON.stringify(ev)}\n`);
    }
    return Buffer.from(parts.join(""), "utf8");
  };

  api.runCheckpointTrust = async (): Promise<OutcomeCertificateV1> => {
    if (!bufferedRunEvents.length && !runLevelReasons.length) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.CLI_USAGE,
        "LangGraphCheckpointTrustGate.runCheckpointTrust requires at least one buffered run event for the workflow.",
      );
    }
    const toolObservedEvents = bufferedRunEvents.filter(isToolObservedRunEvent) as ToolObservedEvent[];
    const eligibility = classifyLangGraphCheckpointTrustEligibility({
      runLevelReasons,
      toolObservedEvents,
    });
    if (!eligibility.eligible) {
      return validatedLangGraphIneligibleCertificate(options.workflowId, eligibility.certificateReasons);
    }
    const result = await verifyRunStateFromBufferedRunEvents({
      workflowId: options.workflowId,
      registryPath,
      database,
      projectRoot,
      bufferedRunEvents,
      runLevelReasons,
      verificationPolicy,
      logStep,
      truthReport,
    });
    const certificate = buildOutcomeCertificateLangGraphCheckpointTrustFromWorkflowResult(result);
    const validateCert = loadSchemaValidator("outcome-certificate-v1");
    if (!validateCert(certificate)) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
        JSON.stringify(validateCert.errors ?? []),
      );
    }
    return certificate;
  };

  api.assertLangGraphCheckpointProductionGate = async (): Promise<void> => {
    const certificate = await api.runCheckpointTrust();
    await assertLangGraphCheckpointProductionGate(certificate, {
      ownerRoutingKey: options.ownerRoutingKey,
      routingTeam: options.routingTeam,
      ownerSlug: options.ownerSlug,
    });
  };

  return api;
}
