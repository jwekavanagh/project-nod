import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseBatchVerifyCliArgs, type ParsedBatchVerifyCli } from "../cliArgv.js";
import {
  CLI_OPERATIONAL_CODES,
  cliErrorEnvelope,
  formatOperationalMessage,
} from "../failureCatalog.js";
import {
  classifyLangGraphCheckpointTrustEligibility,
} from "../langGraphCheckpointTrustGate.js";
import { validatedLangGraphIneligibleCertificate } from "../langGraphCheckpointTrustIneligibleCertificate.js";
import { eventsFileHasSchemaV3ToolObservedForWorkflow, loadEventsForWorkflow } from "../loadEvents.js";
import { verifyWorkflow } from "../pipeline.js";
import { TruthLayerError } from "../truthLayerError.js";
import type { LoadEventsResult, WorkflowResult } from "../types.js";
import { writeRunBundleCli } from "../writeRunBundleCli.js";
import { newActivationHttpCorrelationId } from "../commercial/activationCorrelation.js";
import { runLicensePreflightIfNeeded } from "../commercial/licensePreflight.js";
import { postVerifyOutcomeBeacon } from "../commercial/postVerifyOutcomeBeacon.js";
import { classifyBatchVerifyWorkload } from "../commercial/verifyWorkloadClassify.js";
import { LICENSE_PREFLIGHT_ENABLED } from "../generated/commercialBuildFlags.js";
import {
  formatContractVerifyStderrForStderrLine,
  formatContractVerifyStderrForStderrWrite,
} from "../decisionEvidenceHumanLayer.js";
import { maybeEmitOssClaimTicketUrlToStderr } from "../telemetry/maybeEmitOssClaimTicketUrl.js";
import { classifyWorkflowLineage } from "../funnel/workflowLineageClassify.js";
import { postProductActivationEvent } from "../telemetry/postProductActivationEvent.js";
import {
  buildOutcomeCertificateLangGraphCheckpointTrustFromWorkflowResult,
  type OutcomeCertificateV1,
} from "../outcomeCertificate.js";
import { loadSchemaValidator } from "../schemaLoad.js";
import { postPublicVerificationReport } from "../shareReport/postPublicVerificationReport.js";
import { verifyRunStateFromBufferedRunEvents } from "../verifyRunStateFromBufferedRunEvents.js";
import {
  CLI_EXITED_AFTER_ERROR,
  emitOutcomeCertificateCliAndExitByStateRelation,
  runStandardVerifyWorkflowCliToTerminalResult,
} from "../standardVerifyWorkflowCli.js";
import { exitAfterVerifyCliReceipt } from "../cliExecutionFinalize.js";
import { writeDecisionEvidenceBundle } from "../decisionEvidenceBundle/index.js";

function terminalStatusFromCertificate(
  c: import("../outcomeCertificate.js").OutcomeCertificateV1,
): "complete" | "inconsistent" | "incomplete" {
  if (c.stateRelation === "matches_expectations") return "complete";
  if (c.stateRelation === "does_not_match") return "inconsistent";
  return "incomplete";
}

function writeCliError(code: string, message: string): void {
  console.error(cliErrorEnvelope(code, formatOperationalMessage(message)));
}

function maybeWriteDecisionEvidenceBundle(
  parsedBatch: ParsedBatchVerifyCli,
  certificate: OutcomeCertificateV1,
  runId: string,
): void {
  if (parsedBatch.writeDecisionBundleDir === undefined) return;
  try {
    let attestation: unknown | undefined;
    let nextAction: unknown | undefined;
    if (parsedBatch.decisionAttestationPath !== undefined) {
      attestation = JSON.parse(readFileSync(path.resolve(parsedBatch.decisionAttestationPath), "utf8")) as unknown;
    }
    if (parsedBatch.decisionNextActionPath !== undefined) {
      nextAction = JSON.parse(readFileSync(path.resolve(parsedBatch.decisionNextActionPath), "utf8")) as unknown;
    }
    writeDecisionEvidenceBundle({
      outDir: parsedBatch.writeDecisionBundleDir,
      certificate,
      noHumanReport: parsedBatch.noHumanReport,
      runId,
      ...(attestation !== undefined ? { attestation } : {}),
      ...(nextAction !== undefined ? { nextAction } : {}),
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      return exitAfterVerifyCliReceipt({
        parsedBatch,
        certificate: null,
        exitCode: 3,
        operationalCode: e.code,
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    return exitAfterVerifyCliReceipt({
      parsedBatch,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
    });
  }
}

export async function runBatchVerifyWithTelemetrySubcommand(
  batchArgs: string[],
  opts: {
    telemetrySubcommand: "batch_verify" | "verify_integrator_owned";
    rejectBundled: boolean;
    /** Runs after telemetry posts and OSS claim, immediately before stdout JSON + exit. */
    stderrAppendBeforeStdout?: (result: WorkflowResult) => void;
  },
): Promise<void> {
  let parsedMaybe: ParsedBatchVerifyCli | null = null;
  try {
    parsedMaybe = parseBatchVerifyCliArgs(batchArgs);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      return exitAfterVerifyCliReceipt({
        parsedBatch: null,
        certificate: null,
        exitCode: 3,
        operationalCode: e.code,
      });
    }
    throw e;
  }
  if (parsedMaybe === null) throw new Error("batch verify parse: unreachable null");
  const parsedBatch = parsedMaybe;

  if (
    !parsedBatch.langgraphCheckpointTrust &&
    eventsFileHasSchemaV3ToolObservedForWorkflow(parsedBatch.eventsPath, parsedBatch.workflowId)
  ) {
    writeCliError(
      CLI_OPERATIONAL_CODES.LANGGRAPH_CHECKPOINT_TRUST_GENERIC_MODE_CONFLICT,
      formatOperationalMessage(
        "Events contain schemaVersion 3 tool_observed for this workflow. Use --langgraph-checkpoint-trust for LangGraph checkpoint trust mode, or emit schemaVersion 1/2 only for generic verify.",
      ),
    );
    return exitAfterVerifyCliReceipt({
      parsedBatch,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.LANGGRAPH_CHECKPOINT_TRUST_GENERIC_MODE_CONFLICT,
    });
  }

  const batchActivationRunId =
    process.env.AGENTSKEPTIC_RUN_ID?.trim() ||
    process.env.WORKFLOW_VERIFIER_RUN_ID?.trim() ||
    randomUUID();
  const batchHttpCorrelationId = newActivationHttpCorrelationId();
  let batchPreflight: { runId: string | null };
  try {
    batchPreflight = await runLicensePreflightIfNeeded("verify", {
      runId: batchActivationRunId,
      xRequestId: batchHttpCorrelationId,
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      return exitAfterVerifyCliReceipt({
        parsedBatch,
        certificate: null,
        exitCode: 3,
        operationalCode: e.code,
      });
    }
    throw e;
  }

  const batchBuildProfile = LICENSE_PREFLIGHT_ENABLED ? ("commercial" as const) : ("oss" as const);
  const batchWorkloadClass = classifyBatchVerifyWorkload({
    eventsPath: parsedBatch.eventsPath,
    registryPath: parsedBatch.registryPath,
    database: parsedBatch.database,
  });
  if (opts.rejectBundled && batchWorkloadClass === "bundled_examples") {
    process.stderr.write(
      "INTEGRATOR_OWNED_GATE: integrator-owned contract verify rejects workload_class=bundled_examples (shipped example paths).\n" +
        "bundled_examples: use standard batch verify for demos, or pass integrator-owned --events, --registry, and --db paths. See docs/first-run-integration.md.\n",
    );
    return exitAfterVerifyCliReceipt({
      parsedBatch,
      certificate: null,
      exitCode: 2,
      operationalCode: null,
      verdictIncompleteWithoutCertificate: true,
    });
  }

  const batchLineage = classifyWorkflowLineage({
    subcommand: opts.telemetrySubcommand,
    workloadClass: batchWorkloadClass,
    workflowId: parsedBatch.workflowId,
  });
  await postProductActivationEvent({
    phase: "verify_started",
    run_id: batchActivationRunId,
    issued_at: new Date().toISOString(),
    workload_class: batchWorkloadClass,
    workflow_lineage: batchLineage,
    subcommand: opts.telemetrySubcommand,
    build_profile: batchBuildProfile,
  });

  /** Receipt-aware exit paths for verdict (0–2) after stdout certificate emission. */
  const verdictCliIoFor = (certificate: OutcomeCertificateV1) => ({
    consoleLog: (line: string) => {
      console.log(line);
    },
    stderrLine: (line: string) => {
      console.error(line);
    },
    exit: (code: number): never =>
      exitAfterVerifyCliReceipt({
        parsedBatch,
        certificate,
        exitCode: code,
        operationalCode: null,
      }),
  });

  /** Runner phase (`runStandardVerifyWorkflowCliToTerminalResult`): operational exits only emit receipts here. */
  const verifyRunnerIo = {
    consoleLog: (line: string) => {
      console.log(line);
    },
    stderrLine: (line: string) => {
      console.error(line);
    },
    exitOperational: (operationalCode: string): never =>
      exitAfterVerifyCliReceipt({
        parsedBatch,
        certificate: null,
        exitCode: 3,
        operationalCode,
      }),
    exit: (_code: number): never =>
      exitAfterVerifyCliReceipt({
        parsedBatch,
        certificate: null,
        exitCode: 3,
        operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      }),
  };

  const projectRoot = path.resolve(process.cwd());

  async function finishCertificateTelemetryAndExit(
    certificate: OutcomeCertificateV1,
    workflowResultForStderrHook: WorkflowResult | undefined,
    humanAndShareMode: "afterStandardRunner" | "ineligibleCertificateOnly",
  ): Promise<void> {
    if (humanAndShareMode === "ineligibleCertificateOnly") {
      const shareOrigin = parsedBatch.shareReportOrigin;
      if (shareOrigin !== undefined) {
        const shareRes = await postPublicVerificationReport(shareOrigin, {
          schemaVersion: 2,
          certificate,
        });
        if (!shareRes.ok) {
          writeCliError(
            CLI_OPERATIONAL_CODES.SHARE_REPORT_FAILED,
            formatOperationalMessage(
              `share_report_origin=${shareOrigin} http_status=${String(shareRes.status)} detail=${shareRes.bodySnippet}`,
            ),
          );
          exitAfterVerifyCliReceipt({
            parsedBatch,
            certificate: null,
            exitCode: 3,
            operationalCode: CLI_OPERATIONAL_CODES.SHARE_REPORT_FAILED,
          });
        }
        if (!parsedBatch.noHumanReport) {
          console.error(formatContractVerifyStderrForStderrLine(certificate));
        }
      } else if (!parsedBatch.noHumanReport) {
        process.stderr.write(formatContractVerifyStderrForStderrWrite(certificate));
      }
    } else if (!parsedBatch.noHumanReport && parsedBatch.shareReportOrigin === undefined) {
      process.stderr.write(formatContractVerifyStderrForStderrWrite(certificate));
    }
    const terminalStatus = terminalStatusFromCertificate(certificate);
    await postProductActivationEvent({
      phase: "verify_outcome",
      run_id: batchActivationRunId,
      issued_at: new Date().toISOString(),
      workload_class: batchWorkloadClass,
      workflow_lineage: batchLineage,
      subcommand: opts.telemetrySubcommand,
      build_profile: batchBuildProfile,
      terminal_status: terminalStatus,
    });
    if (!parsedBatch.noHumanReport) {
      await maybeEmitOssClaimTicketUrlToStderr({
        run_id: batchActivationRunId,
        terminal_status: terminalStatus,
        workload_class: batchWorkloadClass,
        subcommand: opts.telemetrySubcommand,
        build_profile: batchBuildProfile,
        xRequestId: batchHttpCorrelationId,
      });
    }
    await postVerifyOutcomeBeacon({
      runId: batchPreflight.runId,
      certificate,
      terminal_status: terminalStatus,
      workload_class: batchWorkloadClass,
      subcommand: opts.telemetrySubcommand,
      xRequestId: batchHttpCorrelationId,
    });
    if (workflowResultForStderrHook !== undefined) {
      opts.stderrAppendBeforeStdout?.(workflowResultForStderrHook);
    }
    emitOutcomeCertificateCliAndExitByStateRelation(certificate, verdictCliIoFor(certificate));
  }

  let langGraphEligibleLoad: LoadEventsResult | undefined;
  if (parsedBatch.langgraphCheckpointTrust) {
    const load = loadEventsForWorkflow(parsedBatch.eventsPath, parsedBatch.workflowId);
    const eligibility = classifyLangGraphCheckpointTrustEligibility({
      runLevelReasons: load.runLevelReasons,
      toolObservedEvents: load.events,
    });
    if (!eligibility.eligible) {
      try {
        const certificate = validatedLangGraphIneligibleCertificate(
          parsedBatch.workflowId,
          eligibility.certificateReasons,
        );
        maybeWriteDecisionEvidenceBundle(parsedBatch, certificate, batchActivationRunId);
        await finishCertificateTelemetryAndExit(certificate, undefined, "ineligibleCertificateOnly");
      } catch (e) {
        if (e instanceof Error && e.message === CLI_EXITED_AFTER_ERROR) return;
        throw e;
      }
      return;
    }
    langGraphEligibleLoad = load;
  }

  try {
    const { certificate, workflowResult } = await runStandardVerifyWorkflowCliToTerminalResult({
      shareReportOrigin: parsedBatch.shareReportOrigin,
      runVerify: parsedBatch.langgraphCheckpointTrust
        ? undefined
        : () =>
            verifyWorkflow({
              workflowId: parsedBatch.workflowId,
              eventsPath: parsedBatch.eventsPath,
              registryPath: parsedBatch.registryPath,
              database: parsedBatch.database,
              verificationPolicy: parsedBatch.verificationPolicy,
              truthReport: () => {},
            }),
      runVerifyWithCertificate: parsedBatch.langgraphCheckpointTrust
        ? async () => {
            const load = langGraphEligibleLoad!;
            const workflowResult = await verifyRunStateFromBufferedRunEvents({
              workflowId: parsedBatch.workflowId,
              registryPath: parsedBatch.registryPath,
              database: parsedBatch.database,
              projectRoot,
              bufferedRunEvents: load.runEvents,
              runLevelReasons: load.runLevelReasons,
              verificationPolicy: parsedBatch.verificationPolicy,
              logStep: () => {},
              truthReport: () => {},
            });
            const validateWf = loadSchemaValidator("workflow-result");
            if (!validateWf(workflowResult)) {
              throw new TruthLayerError(
                CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
                JSON.stringify(validateWf.errors ?? []),
              );
            }
            const certificate = buildOutcomeCertificateLangGraphCheckpointTrustFromWorkflowResult(workflowResult);
            const validateCert = loadSchemaValidator("outcome-certificate-v1");
            if (!validateCert(certificate)) {
              throw new TruthLayerError(
                CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
                JSON.stringify(validateCert.errors ?? []),
              );
            }
            return { workflowResult, certificate };
          }
        : undefined,
      maybeWriteBundle:
        parsedBatch.writeRunBundleDir === undefined
          ? undefined
          : (wfResult: WorkflowResult) =>
              writeRunBundleCli(
                parsedBatch.writeRunBundleDir!,
                readFileSync(path.resolve(parsedBatch.eventsPath)),
                wfResult,
                parsedBatch.signPrivateKeyPath,
              ),
      io: verifyRunnerIo,
    });
    maybeWriteDecisionEvidenceBundle(parsedBatch, certificate, batchActivationRunId);
    await finishCertificateTelemetryAndExit(certificate, workflowResult, "afterStandardRunner");
  } catch (e) {
    if (e instanceof Error && e.message === CLI_EXITED_AFTER_ERROR) return;
    throw e;
  }
}
