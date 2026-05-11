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
import { writeContractProofArtifacts } from "./writeContractProofArtifacts.js";
import { newActivationHttpCorrelationId } from "../commercial/activationCorrelation.js";
import { runLicensePreflightIfNeeded } from "../commercial/licensePreflight.js";
import { postVerifyOutcomeBeacon } from "../commercial/postVerifyOutcomeBeacon.js";
import { classifyBatchVerifyWorkload } from "../commercial/verifyWorkloadClassify.js";
import { LICENSE_PREFLIGHT_ENABLED } from "../generated/commercialBuildFlags.js";
import {
  formatContractVerifyStderrForStderrLine,
  formatContractVerifyStderrForStderrWrite,
} from "../decisionEvidenceHumanLayer.js";
import { baseExitFromStateRelation, resolveFinalExitCode } from "../coverageBudgetExit.js";
import {
  evaluateCoverageBudgetPhaseB,
  writeCoverageBudgetMachineLinesToStderr,
  type CoverageBudgetEvaluation,
} from "../coverageBudget.js";
import { loadCoverageBudgetPolicyPhaseA, type CoverageBudgetPhaseAResult } from "../coverageBudgetPolicy.js";
import { maybePromptTelemetryAfterFirstOfflineSuccess } from "../telemetry/telemetryOfflineConsentPrompt.js";
import { printProductActivationTelemetryStatusLineOnce } from "../telemetry/telemetryStatusLine.js";
import { maybeEmitOssClaimTicketUrlToStderr } from "../telemetry/maybeEmitOssClaimTicketUrl.js";
import { classifyWorkflowLineage } from "../funnel/workflowLineageClassify.js";
import { postProductActivationEvent } from "../telemetry/postProductActivationEvent.js";
import {
  buildOutcomeCertificateLangGraphCheckpointTrustFromWorkflowResult,
  truthCheckVerdictFromCertificate,
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

  printProductActivationTelemetryStatusLineOnce();

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

  let budgetPhaseA: CoverageBudgetPhaseAResult = { active: false };
  try {
    budgetPhaseA = loadCoverageBudgetPolicyPhaseA({
      explicitCoverageBudgetPath: parsedBatch.coverageBudgetPathArg,
      projectPathResolved: parsedBatch.projectPath,
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
  if (parsedBatch.enforceCoverageBudget === true && !budgetPhaseA.active) {
    writeCliError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      formatOperationalMessage(
        "coverage-budget: --enforce-coverage-budget requires an active policy (--coverage-budget <path> or agentskeptic/coverage-budget.json beside --project).",
      ),
    );
    return exitAfterVerifyCliReceipt({
      parsedBatch,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.CLI_USAGE,
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
        "bundled_examples: use standard batch verify for demos, or pass integrator-owned --events, --registry, and --db paths. See docs/integrate.md.\n",
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

  function evaluateBudgetOrNull(certificate: OutcomeCertificateV1): CoverageBudgetEvaluation | null {
    if (!budgetPhaseA.active) return null;
    return evaluateCoverageBudgetPhaseB({
      certificate,
      policy: budgetPhaseA.policy,
      policyPath: budgetPhaseA.policyPath,
    });
  }

  function writeTruthCheckVerdictPrefixIfNeeded(
    certificate: OutcomeCertificateV1,
    budgetEval: CoverageBudgetEvaluation | null,
  ): void {
    if (!parsedBatch.invokedViaCheck) return;
    process.stderr.write(`truth_check_verdict: ${truthCheckVerdictFromCertificate(certificate)}\n`);
    process.stderr.write(`release_critical_truth_check_verdict: ${certificate.releaseCriticalVerdict}\n`);
    if (budgetEval !== null) {
      writeCoverageBudgetMachineLinesToStderr(budgetEval);
    }
  }

  function humanBudgetPrefix(budgetEval: CoverageBudgetEvaluation | null): string | undefined {
    if (parsedBatch.noHumanReport || budgetEval === null) return undefined;
    return budgetEval.humanBlock;
  }

  async function finishCertificateTelemetryAndExit(
    certificate: OutcomeCertificateV1,
    workflowResultForStderrHook: WorkflowResult | undefined,
    humanAndShareMode: "afterStandardRunner" | "ineligibleCertificateOnly",
  ): Promise<void> {
    const budgetEval = evaluateBudgetOrNull(certificate);
    const hb = humanBudgetPrefix(budgetEval);
    if (humanAndShareMode === "ineligibleCertificateOnly") {
      const shareOrigin = parsedBatch.shareReportOrigin;
      if (shareOrigin !== undefined) {
        const shareRes = await postPublicVerificationReport(shareOrigin, {
          schemaVersion: 3,
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
        writeTruthCheckVerdictPrefixIfNeeded(certificate, budgetEval);
        if (!parsedBatch.noHumanReport) {
          console.error(formatContractVerifyStderrForStderrLine(certificate, { prefixBeforeHuman: hb }));
        }
      } else if (!parsedBatch.noHumanReport) {
        writeTruthCheckVerdictPrefixIfNeeded(certificate, budgetEval);
        process.stderr.write(formatContractVerifyStderrForStderrWrite(certificate, { prefixBeforeHuman: hb }));
      } else {
        writeTruthCheckVerdictPrefixIfNeeded(certificate, budgetEval);
      }
    } else if (!parsedBatch.noHumanReport && parsedBatch.shareReportOrigin === undefined) {
      writeTruthCheckVerdictPrefixIfNeeded(certificate, budgetEval);
      process.stderr.write(formatContractVerifyStderrForStderrWrite(certificate, { prefixBeforeHuman: hb }));
    } else if (parsedBatch.noHumanReport && parsedBatch.shareReportOrigin === undefined) {
      writeTruthCheckVerdictPrefixIfNeeded(certificate, budgetEval);
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
    await maybePromptTelemetryAfterFirstOfflineSuccess({
      verificationUsedOnlyLocalSqliteFile: parsedBatch.database.kind === "sqlite",
      shareReportOriginUsed: parsedBatch.shareReportOrigin !== undefined,
      verifySucceeded: certificate.stateRelation === "matches_expectations",
    });
    if (workflowResultForStderrHook !== undefined) {
      opts.stderrAppendBeforeStdout?.(workflowResultForStderrHook);
    }
    const baseExit = baseExitFromStateRelation(certificate.stateRelation);
    const finalExit = resolveFinalExitCode({
      baseExit,
      budgetActive: budgetPhaseA.active,
      budgetVerdict: budgetEval?.verdict ?? null,
      enforceCoverageBudget: parsedBatch.enforceCoverageBudget === true,
    });
    emitOutcomeCertificateCliAndExitByStateRelation(certificate, verdictCliIoFor(certificate), {
      exitCodeOverride: finalExit,
    });
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
      truthCheckInvoked: parsedBatch.invokedViaCheck,
      noHumanReport: parsedBatch.noHumanReport,
      coverageBudgetPhaseA: budgetPhaseA,
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
            const validateCert = loadSchemaValidator("outcome-certificate-v3");
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
        parsedBatch.writeRunBundleDir === undefined &&
        parsedBatch.writeDecisionBundleDir === undefined
          ? undefined
          : (wfResult: WorkflowResult, certificate: OutcomeCertificateV1) => {
              if (
                parsedBatch.writeRunBundleDir !== undefined &&
                parsedBatch.writeDecisionBundleDir !== undefined
              ) {
                writeContractProofArtifacts({
                  proofRunDir: parsedBatch.writeRunBundleDir,
                  proofDecisionDir: parsedBatch.writeDecisionBundleDir,
                  eventsPath: parsedBatch.eventsPath,
                  workflowResult: wfResult,
                  certificate,
                  runBundleSignKeyPath: parsedBatch.signPrivateKeyPath,
                });
                return;
              }
              if (parsedBatch.writeRunBundleDir !== undefined) {
                writeRunBundleCli(
                  parsedBatch.writeRunBundleDir,
                  readFileSync(path.resolve(parsedBatch.eventsPath)),
                  wfResult,
                  parsedBatch.signPrivateKeyPath,
                );
              }
            },
      io: verifyRunnerIo,
    });
    if (
      !(parsedBatch.writeRunBundleDir !== undefined && parsedBatch.writeDecisionBundleDir !== undefined)
    ) {
      maybeWriteDecisionEvidenceBundle(parsedBatch, certificate, batchActivationRunId);
    }
    await finishCertificateTelemetryAndExit(certificate, workflowResult, "afterStandardRunner");
  } catch (e) {
    if (e instanceof Error && e.message === CLI_EXITED_AFTER_ERROR) return;
    throw e;
  }
}
