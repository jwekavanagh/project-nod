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
import { formatDistributionFooter } from "../distributionFooter.js";
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

export async function runBatchVerifyWithTelemetrySubcommand(
  batchArgs: string[],
  opts: {
    telemetrySubcommand: "batch_verify" | "verify_integrator_owned";
    rejectBundled: boolean;
    /** Runs after telemetry posts and OSS claim, immediately before stdout JSON + exit. */
    stderrAppendBeforeStdout?: (result: WorkflowResult) => void;
  },
): Promise<void> {
  let parsedBatch: ParsedBatchVerifyCli;
  try {
    parsedBatch = parseBatchVerifyCliArgs(batchArgs);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

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
    process.exit(3);
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
      process.exit(3);
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
    process.exit(2);
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
  const batchIo = {
    consoleLog: (line: string) => {
      console.log(line);
    },
    stderrLine: (line: string) => {
      console.error(line);
    },
    exit: (code: number) => {
      process.exit(code);
    },
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
          batchIo.exit(3);
          throw new Error(CLI_EXITED_AFTER_ERROR);
        }
        if (!parsedBatch.noHumanReport) {
          batchIo.stderrLine(`${certificate.humanReport}\n${formatDistributionFooter()}`);
        }
      } else if (!parsedBatch.noHumanReport) {
        process.stderr.write(`${certificate.humanReport}\n${formatDistributionFooter()}\n`);
      }
    } else if (!parsedBatch.noHumanReport && parsedBatch.shareReportOrigin === undefined) {
      process.stderr.write(`${certificate.humanReport}\n${formatDistributionFooter()}\n`);
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
    emitOutcomeCertificateCliAndExitByStateRelation(certificate, batchIo);
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
      io: batchIo,
    });
    await finishCertificateTelemetryAndExit(certificate, workflowResult, "afterStandardRunner");
  } catch (e) {
    if (e instanceof Error && e.message === CLI_EXITED_AFTER_ERROR) return;
    throw e;
  }
}
