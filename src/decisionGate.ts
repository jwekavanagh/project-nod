import path from "node:path";
import { parseVerificationDatabaseUrl } from "./verificationDatabaseUrl.js";
import { CLI_OPERATIONAL_CODES, runLevelIssue } from "./failureCatalog.js";
import { assertValidRunEventParentGraph } from "./executionTrace.js";
import {
  buildOutcomeCertificateFromWorkflowResult,
  type OutcomeCertificateV1,
} from "./outcomeCertificate.js";
import { verifyRunStateFromBufferedRunEvents } from "./verifyRunStateFromBufferedRunEvents.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { resolveVerificationPolicyInput } from "./verificationPolicy.js";
import { TruthLayerError } from "./truthLayerError.js";
import type { Reason, RunEvent, VerificationDatabase, VerificationPolicy, WorkflowResult } from "./types.js";
import { trustDecisionFromCertificate } from "./trustDecision.js";
import { finalizeIrreversibleBlockThrow } from "./finalizeIrreversibleTrustBlock.js";

const validateEvent = loadSchemaValidator("event");

function verificationDatabaseFromUrl(databaseUrl: string, projectRoot: string): VerificationDatabase {
  return parseVerificationDatabaseUrl(databaseUrl, projectRoot);
}

export type CreateDecisionGateOptions = {
  workflowId: string;
  registryPath: string;
  databaseUrl: string;
  projectRoot?: string;
  verificationPolicy?: VerificationPolicy;
  logStep?: (line: object) => void;
  truthReport?: (report: string) => void;
  /** Overrides **`routing.routing_key`** in **`TrustDecisionRecordV1`** (default **`workflowId`**). */
  ownerRoutingKey?: string;
  routingTeam?: string;
  ownerSlug?: string;
};

export type DecisionGate = {
  appendRunEvent(value: unknown): void;
  toNdjsonUtf8(): Buffer;
  assertEmissionQuality(): void;
  evaluate(): Promise<WorkflowResult>;
  evaluateCertificate(): Promise<OutcomeCertificateV1>;
  assertSafeForIrreversibleAction(): Promise<void>;
};

/**
 * Runtime integration: buffer structured run events, evaluate against the registry + DB, assert before irreversible work.
 * Prefer the public `createDecisionGate` export from the package root (deprecated wrapper) or `AgentSkeptic` in v2+.
 */
export function createDecisionGateImpl(options: CreateDecisionGateOptions): DecisionGate {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const registryPath = path.resolve(projectRoot, options.registryPath);
  const verificationPolicy = resolveVerificationPolicyInput(options.verificationPolicy);
  const database = verificationDatabaseFromUrl(options.databaseUrl, projectRoot);
  const logStep = options.logStep ?? (() => {});
  const truthReport = options.truthReport ?? (() => {});

  const bufferedRunEvents: RunEvent[] = [];
  const runLevelReasons: Reason[] = [];

  const api = {} as DecisionGate;

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

  api.assertEmissionQuality = (): void => {
    if (runLevelReasons.length > 0) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.EMIT_LINT_FAILED,
        "Buffered run events contain malformed inputs from appendRunEvent.",
      );
    }
    if (bufferedRunEvents.length === 0) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.EMIT_LINT_FAILED,
        "No buffered run events are available for emission-quality checks.",
      );
    }
    assertValidRunEventParentGraph(bufferedRunEvents);
  };

  api.evaluate = async (): Promise<WorkflowResult> => {
    if (!bufferedRunEvents.length && !runLevelReasons.length) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.CLI_USAGE,
        "DecisionGate.evaluate requires at least one buffered run event for the workflow.",
      );
    }
    return verifyRunStateFromBufferedRunEvents({
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
  };

  api.evaluateCertificate = async (): Promise<OutcomeCertificateV1> => {
    const result = await api.evaluate();
    const certificate = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    const validateCert = loadSchemaValidator("outcome-certificate-v1");
    if (!validateCert(certificate)) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
        JSON.stringify(validateCert.errors ?? []),
      );
    }
    return certificate;
  };

  api.assertSafeForIrreversibleAction = async (): Promise<void> => {
    const certificate = await api.evaluateCertificate();
    if (trustDecisionFromCertificate(certificate) === "safe") {
      return;
    }
    await finalizeIrreversibleBlockThrow({
      certificate,
      gateKind: "contract_sql_irreversible",
      routingOpts: {
        workflowIdFallback: options.workflowId,
        ownerRoutingKey: options.ownerRoutingKey,
        routingTeam: options.routingTeam,
        ownerSlug: options.ownerSlug,
      },
    });
  };

  return api;
}
