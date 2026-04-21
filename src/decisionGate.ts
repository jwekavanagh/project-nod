import path from "node:path";
import { isToolObservedRunEvent } from "./executionTrace.js";
import { CLI_OPERATIONAL_CODES, runLevelIssue } from "./failureCatalog.js";
import {
  buildOutcomeCertificateFromWorkflowResult,
  type OutcomeCertificateV1,
} from "./outcomeCertificate.js";
import { loadToolsRegistry, verifyRunStateFromEvents } from "./pipeline.js";
import { prepareWorkflowEvents } from "./prepareWorkflowEvents.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { resolveVerificationPolicyInput } from "./verificationPolicy.js";
import { TruthLayerError } from "./truthLayerError.js";
import type {
  Reason,
  RunEvent,
  ToolObservedEvent,
  VerificationDatabase,
  VerificationPolicy,
  WorkflowResult,
} from "./types.js";
import { trustDecisionFromCertificate } from "./trustDecision.js";
import { formatDecisionBlockerForHumans } from "./decisionBlocker.js";
import { DecisionUnsafeError } from "./decisionUnsafeError.js";

const validateEvent = loadSchemaValidator("event");
const POSTGRES_URL_RE = /^postgres(ql)?:\/\//i;

function verificationDatabaseFromUrl(databaseUrl: string, projectRoot: string): VerificationDatabase {
  if (POSTGRES_URL_RE.test(databaseUrl)) {
    return { kind: "postgres", connectionString: databaseUrl };
  }
  return { kind: "sqlite", path: path.resolve(projectRoot, databaseUrl) };
}

export type CreateDecisionGateOptions = {
  workflowId: string;
  registryPath: string;
  databaseUrl: string;
  projectRoot?: string;
  verificationPolicy?: VerificationPolicy;
  logStep?: (line: object) => void;
  truthReport?: (report: string) => void;
};

export type DecisionGate = {
  appendRunEvent(value: unknown): void;
  toNdjsonUtf8(): Buffer;
  evaluate(): Promise<WorkflowResult>;
  evaluateCertificate(): Promise<OutcomeCertificateV1>;
  assertSafeForIrreversibleAction(): Promise<void>;
};

/**
 * Runtime integration: buffer structured run events, evaluate against the registry + DB, assert before irreversible work.
 */
export function createDecisionGate(options: CreateDecisionGateOptions): DecisionGate {
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

  api.evaluate = async (): Promise<WorkflowResult> => {
    if (!bufferedRunEvents.length && !runLevelReasons.length) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.CLI_USAGE,
        "DecisionGate.evaluate requires at least one buffered run event for the workflow.",
      );
    }
    if (!bufferedRunEvents.length) {
      const registry = loadToolsRegistry(registryPath);
      return verifyRunStateFromEvents({
        workflowId: options.workflowId,
        events: [],
        runEvents: [],
        runLevelReasons: [...runLevelReasons],
        eventSequenceIntegrity: { kind: "normal" },
        eventFileAggregateCounts: {
          eventFileNonEmptyLines: 0,
          schemaValidEvents: 0,
          toolObservedForRequestedWorkflowId: 0,
          toolObservedForOtherWorkflowIds: 0,
        },
        registry,
        database,
        verificationPolicy,
        logStep,
        truthReport,
      });
    }
    const toolCandidates: ToolObservedEvent[] = [];
    for (const ev of bufferedRunEvents) {
      if (isToolObservedRunEvent(ev)) {
        toolCandidates.push(ev);
      }
    }
    const { eventsSorted, eventSequenceIntegrity } = prepareWorkflowEvents(toolCandidates);
    const registry = loadToolsRegistry(registryPath);
    return verifyRunStateFromEvents({
      workflowId: options.workflowId,
      events: eventsSorted,
      runEvents: bufferedRunEvents,
      runLevelReasons: [...runLevelReasons],
      eventSequenceIntegrity,
      eventFileAggregateCounts: {
        eventFileNonEmptyLines: 0,
        schemaValidEvents: 0,
        toolObservedForRequestedWorkflowId: toolCandidates.length,
        toolObservedForOtherWorkflowIds: 0,
      },
      registry,
      database,
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
    if (trustDecisionFromCertificate(certificate) !== "safe") {
      const { lines } = formatDecisionBlockerForHumans(certificate);
      throw new DecisionUnsafeError(certificate, lines);
    }
  };

  return api;
}
