import { readFileSync } from "node:fs";
import path from "node:path";
import { parseBatchVerifyCliArgs, argValue, removeArgPair } from "../cliArgv.js";
import { runBatchVerifyToValidatedCertificate } from "../standardVerifyWorkflowCli.js";
import { verifyWorkflow } from "../pipeline.js";
import { TruthLayerError } from "../truthLayerError.js";
import { cliErrorEnvelope, CLI_OPERATIONAL_CODES, formatOperationalMessage } from "../failureCatalog.js";
import { buildFailureHint } from "./failureHints.js";
import { renderLoopOperationalUnknown, renderLoopTerminalContract } from "./loopOutput.js";
import { latestCompatiblePriorRun, storeLoopRun } from "./localRunStore.js";
import { normalizeToEmittedWorkflowResult } from "../workflowResultNormalize.js";
import { buildRegressionArtifactFromDebugCorpus } from "../regressionArtifact.js";
import type { WorkflowResult } from "../types.js";

function parseMaxRuns(args: string[]): number {
  const raw = argValue(args, "--max-history-runs");
  if (raw === undefined) return 100;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "--max-history-runs must be an integer >= 1.",
    );
  }
  return n;
}

function runRef(workflowId: string, runDir: string, capturedAt: string): string {
  return `${capturedAt} workflowId=${workflowId} path=${runDir}`;
}

function readWorkflowResultFromPath(workflowResultPath: string): WorkflowResult {
  const raw = readFileSync(workflowResultPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return normalizeToEmittedWorkflowResult(parsed as WorkflowResult);
}

export async function runLoopSubcommand(args: string[]): Promise<void> {
  const maxRuns = parseMaxRuns(args);
  const filteredArgs = removeArgPair(args, "--max-history-runs");
  let parsed;
  try {
    parsed = parseBatchVerifyCliArgs(filteredArgs);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      process.stderr.write(`${cliErrorEnvelope(e.code, e.message)}\n`);
      process.exit(3);
    }
    throw e;
  }

  try {
    const { workflowResult, certificate } = await runBatchVerifyToValidatedCertificate(() =>
      verifyWorkflow({
        workflowId: parsed.workflowId,
        eventsPath: parsed.eventsPath,
        registryPath: parsed.registryPath,
        database: parsed.database,
        verificationPolicy: parsed.verificationPolicy,
        truthReport: () => {},
      }),
    );

    const prior = latestCompatiblePriorRun(parsed.workflowId);
    const current = storeLoopRun({
      workflowId: parsed.workflowId,
      eventsPath: parsed.eventsPath,
      workflowResult,
      certificate,
      maxRuns,
    });

    let compare:
      | { kind: "no_local_regression_anchor" }
      | { kind: "summary"; artifact: ReturnType<typeof buildRegressionArtifactFromDebugCorpus> } = {
      kind: "no_local_regression_anchor",
    };
    if (prior) {
      try {
        const priorResult = readWorkflowResultFromPath(prior.workflowResultPath);
        const artifact = buildRegressionArtifactFromDebugCorpus({
          results: [priorResult, workflowResult],
          runIds: [path.basename(prior.runDir), path.basename(current.runDir)],
          eventPaths: [prior.eventsPath, current.eventsPath],
        });
        compare = { kind: "summary", artifact };
      } catch {
        compare = { kind: "no_local_regression_anchor" };
      }
    }

    const output = renderLoopTerminalContract({
      certificate,
      runRef: runRef(parsed.workflowId, current.runDir, current.capturedAt),
      compare,
      failureHint: buildFailureHint(certificate),
    });
    process.stdout.write(`${output}\n`);

    if (certificate.stateRelation === "matches_expectations") process.exit(0);
    if (certificate.stateRelation === "does_not_match") process.exit(1);
    process.exit(2);
  } catch (e) {
    const code = e instanceof TruthLayerError ? e.code : CLI_OPERATIONAL_CODES.INTERNAL_ERROR;
    const msg =
      e instanceof TruthLayerError
        ? e.message
        : formatOperationalMessage(e instanceof Error ? e.message : String(e));
    process.stderr.write(`${cliErrorEnvelope(code, msg)}\n`);
    const out = renderLoopOperationalUnknown({
      message: msg,
      nextAction:
        "Check your CLI args, event/registry paths, and database connectivity, then rerun `agentskeptic loop`.",
      runRef: "unavailable",
    });
    process.stdout.write(`${out}\n`);
    process.exit(3);
  }
}
