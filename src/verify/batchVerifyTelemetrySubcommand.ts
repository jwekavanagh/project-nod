import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseBatchVerifyCliArgs } from "../cliArgv.js";
import {
  CLI_OPERATIONAL_CODES,
  cliErrorEnvelope,
  formatOperationalMessage,
} from "../failureCatalog.js";
import { verifyWorkflow } from "../pipeline.js";
import { TruthLayerError } from "../truthLayerError.js";
import type { WorkflowResult } from "../types.js";
import { writeRunBundleCli } from "../writeRunBundleCli.js";
import { runLicensePreflightIfNeeded } from "../commercial/licensePreflight.js";
import { postVerifyOutcomeBeacon } from "../commercial/postVerifyOutcomeBeacon.js";
import { classifyBatchVerifyWorkload } from "../commercial/verifyWorkloadClassify.js";
import { LICENSE_PREFLIGHT_ENABLED } from "../generated/commercialBuildFlags.js";
import { formatDistributionFooter } from "../distributionFooter.js";
import { maybeEmitOssClaimTicketUrlToStderr } from "../telemetry/maybeEmitOssClaimTicketUrl.js";
import { classifyWorkflowLineage } from "../funnel/workflowLineageClassify.js";
import { postProductActivationEvent } from "../telemetry/postProductActivationEvent.js";
import {
  CLI_EXITED_AFTER_ERROR,
  emitVerifyWorkflowCliJsonAndExitByStatus,
  runStandardVerifyWorkflowCliToTerminalResult,
} from "../standardVerifyWorkflowCli.js";

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
  let parsedBatch;
  try {
    parsedBatch = parseBatchVerifyCliArgs(batchArgs);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const batchActivationRunId =
    process.env.AGENTSKEPTIC_RUN_ID?.trim() ||
    process.env.WORKFLOW_VERIFIER_RUN_ID?.trim() ||
    randomUUID();
  let batchPreflight: { runId: string | null };
  try {
    batchPreflight = await runLicensePreflightIfNeeded("verify", { runId: batchActivationRunId });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const suppressTruthToStderr = parsedBatch.noTruthReport || parsedBatch.shareReportOrigin !== undefined;
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
  try {
    const result = await runStandardVerifyWorkflowCliToTerminalResult({
      shareReportOrigin: parsedBatch.shareReportOrigin,
      runVerify: () =>
        verifyWorkflow({
          workflowId: parsedBatch.workflowId,
          eventsPath: parsedBatch.eventsPath,
          registryPath: parsedBatch.registryPath,
          database: parsedBatch.database,
          verificationPolicy: parsedBatch.verificationPolicy,
          ...(suppressTruthToStderr ?
            { truthReport: () => {} }
          : {
              truthReport: (report: string) => {
                process.stderr.write(`${report}\n`);
                process.stderr.write(formatDistributionFooter());
              },
            }),
        }),
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
    await postProductActivationEvent({
      phase: "verify_outcome",
      run_id: batchActivationRunId,
      issued_at: new Date().toISOString(),
      workload_class: batchWorkloadClass,
      workflow_lineage: batchLineage,
      subcommand: opts.telemetrySubcommand,
      build_profile: batchBuildProfile,
      terminal_status: result.status,
    });
    if (!parsedBatch.noTruthReport) {
      await maybeEmitOssClaimTicketUrlToStderr({
        run_id: batchActivationRunId,
        terminal_status: result.status,
        workload_class: batchWorkloadClass,
        subcommand: opts.telemetrySubcommand,
        build_profile: batchBuildProfile,
      });
    }
    await postVerifyOutcomeBeacon({
      runId: batchPreflight.runId,
      terminal_status: result.status,
      workload_class: batchWorkloadClass,
      subcommand: opts.telemetrySubcommand,
    });
    opts.stderrAppendBeforeStdout?.(result);
    emitVerifyWorkflowCliJsonAndExitByStatus(result, batchIo);
  } catch (e) {
    if (e instanceof Error && e.message === CLI_EXITED_AFTER_ERROR) return;
    throw e;
  }
}
