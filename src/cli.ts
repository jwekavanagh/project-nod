#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFileSync, statSync, writeSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  CLI_OPERATIONAL_CODES,
  cliErrorEnvelope,
  formatOperationalMessage,
} from "./failureCatalog.js";
import { buildRegressionArtifactFromCompareManifest, stringifyRegressionArtifact } from "./regressionArtifact.js";
import { assertValidRunEventParentGraph, buildExecutionTraceView, formatExecutionTraceText } from "./executionTrace.js";
import { loadEventsForWorkflow } from "./loadEvents.js";
import { verifyWorkflow } from "./pipeline.js";
import { argValue, argValues, parseBatchVerifyCliArgs, parseQuickCliArgs } from "./cliArgv.js";
import { exitAfterQuickVerifyReceipt, exitAfterVerifyCliReceipt } from "./cliExecutionFinalize.js";
import { runExecutionIdentityVerifyCli } from "./executionIdentityVerifyCli.js";
import { runEnforce } from "./enforceCli.js";
import {
  CLI_EXITED_AFTER_ERROR,
  emitVerifyWorkflowCliJsonAndExitByStatus,
  runStandardVerifyWorkflowCliFlow,
} from "./standardVerifyWorkflowCli.js";
import {
  formatRegistryValidationHumanReport,
  validateToolsRegistry,
} from "./registryValidation.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { TruthLayerError } from "./truthLayerError.js";
import { verifyRunBundleSignature } from "./verifyRunBundleSignature.js";
import type { WorkflowEngineResult, WorkflowResult } from "./types.js";
import { isBundlePrivateKeyTruthError, writeRunBundleCli } from "./writeRunBundleCli.js";
import { normalizeToEmittedWorkflowResult } from "./workflowResultNormalize.js";
import {
  debugServerEntryUrl,
  loadCorpusBundle,
  logCorpusLoadErrors,
  startDebugServerOnPort,
} from "./debugServer.js";
import {
  assertPlanPathInsideRepo,
  buildPlanTransitionEventsNdjson,
  buildPlanTransitionWorkflowResult,
  resolveCommitSha,
  sha256HexOfFile,
  type TransitionRulesProvenance,
} from "./planTransition.js";
import { PLAN_TRANSITION_WORKFLOW_ID } from "./planTransitionConstants.js";
import { COMPARE_INPUT_RUN_LEVEL_INCONSISTENT_MESSAGE } from "./runLevelDriftMessages.js";
import { isV9RunLevelCodesInconsistent } from "./workflowRunLevelConsistency.js";
import { buildOutcomeCertificateFromWorkflowResult } from "./outcomeCertificate.js";
import { atomicWriteUtf8File } from "./quickVerify/atomicWrite.js";
import { buildQuickContractEventsNdjson } from "./quickVerify/buildQuickContractEventsNdjson.js";
import { stableStringify } from "./quickVerify/canonicalJson.js";
import { buildOutcomeCertificateFromQuickReport } from "./outcomeCertificate.js";
import { runQuickVerifyToValidatedReport } from "./quickVerify/runQuickVerify.js";
import type { QuickVerifyReport } from "./quickVerify/runQuickVerify.js";
import type { QuickContractExport } from "./quickVerify/buildQuickContractEventsNdjson.js";
import { checkAssuranceReportStale } from "./assurance/checkStale.js";
import {
  buildAssuranceRunOutput,
  buildAssuranceStaleOutput,
  validateAndSerializeAssuranceOutput,
} from "./assurance/buildAssuranceOutput.js";
import { runAssuranceFromManifest } from "./assurance/runAssurance.js";
import { newActivationHttpCorrelationId } from "./commercial/activationCorrelation.js";
import { runLicensePreflightIfNeeded } from "./commercial/licensePreflight.js";
import { postVerifyOutcomeBeacon } from "./commercial/postVerifyOutcomeBeacon.js";
import { quickVerifyVerdictToTerminalStatus } from "./commercial/quickVerifyFunnelTerminalStatus.js";
import { classifyQuickVerifyWorkload } from "./commercial/verifyWorkloadClassify.js";
import { LICENSE_PREFLIGHT_ENABLED } from "./generated/commercialBuildFlags.js";
import { formatDistributionFooter } from "./distributionFooter.js";
import { postPublicVerificationReport } from "./shareReport/postPublicVerificationReport.js";
import { runRegistryDraftCliAndExit } from "./registryDraft/runRegistryDraftCli.js";
import { runBootstrapSubcommand } from "./bootstrap/runBootstrapSubcommand.js";
import { runBatchVerifyWithTelemetrySubcommand } from "./verify/batchVerifyTelemetrySubcommand.js";
import { runCrossingSubcommand } from "./crossing/runCrossingSubcommand.js";
import { runLoopSubcommand } from "./loop/runLoopSubcommand.js";
import { maybeEmitOssClaimTicketUrlToStderr } from "./telemetry/maybeEmitOssClaimTicketUrl.js";
import { classifyWorkflowLineage } from "./funnel/workflowLineageClassify.js";
import { postProductActivationEvent } from "./telemetry/postProductActivationEvent.js";
import { runFunnelAnonCliAndExit } from "./cli/runFunnelAnonSet.js";
import { fetchCurrentUsage } from "./commercial/getCurrentUsage.js";
import { AGENTSKEPTIC_CLI_SEMVER } from "./publicDistribution.generated.js";
import { formatValidationStdout, validateDecisionEvidenceBundle, writeDecisionEvidenceBundle } from "./decisionEvidenceBundle/index.js";

function usageQuick(): string {
  return `Usage:
  agentskeptic quick --input <path> (--postgres-url <url> | --db <sqlitePath>) --export-registry <path>
    [--emit-events <path>] [--workflow-id <id>] [--share-report-origin <https://host>] [--no-human-report]
    [--write-decision-bundle <dir>] [--decision-attestation <path>] [--decision-next-action <path>]

  Input must contain structured tool activity (tool names and parameters extractable as JSON). Verification uses read-only SQL against the database you pass.

  Use - for stdin. Writes registry JSON array atomically, then optional events file, then stdout (see docs/quick-verify-normative.md).
  With --share-report-origin, human stderr is deferred until after a successful POST (same contract as batch verify; see docs/shareable-verification-reports.md).

  CI enforcement over time is provided by "agentskeptic enforce" (stateful, paid). Lock flags are no longer supported on quick.

Exit codes:
  0  verdict pass
  1  verdict fail
  2  verdict uncertain
  3  operational failure (stderr: JSON envelope)

  --help, -h  print this message and exit 0`;
}

function usageLoop(): string {
  return `Usage:
  agentskeptic loop --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>)
    [--consistency strong|eventual] [--verification-window-ms <int>] [--poll-interval-ms <int>] [--max-history-runs <int>]

Canonical local truth loop:
  - runs verification against your real database
  - emits normalized verdict: TRUSTED | NOT TRUSTED | UNKNOWN
  - includes contextual next action on NOT TRUSTED/UNKNOWN
  - auto-compares against latest compatible prior run
  - stores local run history for future comparisons

Exit codes:
  0  TRUSTED
  1  NOT TRUSTED
  2  UNKNOWN (verification incomplete/not established)
  3  operational failure

  --help, -h  print this message and exit 0`;
}

function usageVerify(): string {
  return `Usage:
  agentskeptic loop --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>)
    [--consistency strong|eventual] [--verification-window-ms <int>] [--poll-interval-ms <int>] [--max-history-runs <int>]
    (recommended default local truth loop; emits TRUSTED | NOT TRUSTED | UNKNOWN + auto-compare + run history)

  agentskeptic quick --input <path> (--postgres-url <url> | --db <sqlitePath>) --export-registry <path> [--emit-events <path>] [--workflow-id <id>]
    (advanced/specialized path; structured tool activity + read-only SQL; see docs/quick-verify-normative.md)

  agentskeptic bootstrap --input <path> (--db <sqlitePath> | --postgres-url <url>) --out <path>
    (BootstrapPackInput v1 JSON → contract pack + in-process verify; see docs/bootstrap-pack-normative.md)

  agentskeptic registry-draft --provider hosted_openai|local_ollama --request <registry-draft-request.json> [--out <dir>]
    (DraftEngine assisted draft tools.json + deterministic quick-ingest NDJSON JSON to stdout — see docs/registry-draft.md)

  agentskeptic crossing --bootstrap-input <path> --pack-out <path> (--db <sqlitePath> | --postgres-url <url>) [--no-human-report]
  agentskeptic crossing --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>) [--no-human-report]
    (specialized integrator crossing flow; see docs/crossing-normative.md)

  agentskeptic verify-integrator-owned --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>)
    (specialized compatibility command; rejects bundled example fixture paths with exit 2 — see docs/agentskeptic.md Integrator-owned gate)

  agentskeptic --workflow-id <id> --events <path> --registry <path> --db <sqlitePath>
  agentskeptic --workflow-id <id> --events <path> --registry <path> --postgres-url <url>

  Stateful CI enforcement uses:
  agentskeptic enforce --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>)
  with optional --create-baseline or --accept-drift.

Optional consistency (default strong):
  --consistency strong|eventual
  With eventual, required:
  --verification-window-ms <int>
  --poll-interval-ms <int>   (must be >= 1 and <= window)

With strong, do not pass --verification-window-ms or --poll-interval-ms.

Provide exactly one of --db or --postgres-url.

Optional output:
  --no-human-report   For verdict exits 0–2, do not print certificate.humanReport or distribution footer to stderr (stderr empty). stdout Outcome Certificate JSON is unchanged. Exit 3 stderr is unchanged (single-line JSON envelope).
  --share-report-origin <https://host>   After successful verification, POST a shareable report (v2 envelope) to that origin (https only, origin with no path), then print human report + footer to stderr and Outcome Certificate JSON to stdout. On POST failure: exit 3, stdout empty, stderr single-line JSON envelope (code SHARE_REPORT_FAILED). See docs/shareable-verification-reports.md.

Exit codes:
  0  workflow status complete
  1  workflow status inconsistent
  2  workflow status incomplete
  3  operational failure (see stderr JSON)
  4  reserved for stateful enforce drift mismatch

  agentskeptic compare --manifest <compare-run-manifest.json>
  Compare runs from a manifest (workflow results + events paths; see docs/regression-artifact-normative.md).

  agentskeptic validate-registry --registry <path>
  agentskeptic validate-registry --registry <path> --events <path> --workflow-id <id>
  Validate tools registry JSON (and optionally resolution vs events) without a database.
  See docs/agentskeptic.md (Registry validation).

  agentskeptic execution-trace --workflow-id <id> --events <path> [--workflow-result <path>] [--format json|text]
  Emit ExecutionTraceView JSON or text (see docs/agentskeptic.md).

  agentskeptic enforce --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>)
    [--create-baseline | --accept-drift]
  CI enforcement over time (stateful baseline/drift workflow).

  agentskeptic assurance run --manifest <path> [--write-report <path>]
  agentskeptic assurance stale --report <path> --max-age-hours <n>
  Multi-scenario assurance sweep and staleness gate (see docs/agentskeptic.md).

Advanced / optional (persisted runs, signing, local UI, plan/git checks):
  --write-run-bundle <dir>   Technical run bundle: events.ndjson (byte copy of --events), workflow-result.json, agent-run.json (SHA-256 manifest). Directory is created if missing. Requires exit 0–2 (operational failure skips the write).
  --sign-ed25519-private-key <path>   With --write-run-bundle only: PKCS#8 PEM Ed25519 private key; also writes workflow-result.sig.json and manifest schemaVersion 2.
  --write-decision-bundle <dir>   Decision evidence bundle (outcome certificate, exit, human-layer, manifest; see docs/decision-evidence-bundle.md). Opt-in.
  --decision-attestation <path>   Optional JSON merged into attestation.json when --write-decision-bundle is set.
  --decision-next-action <path>   Optional JSON merged into next-action.json when --write-decision-bundle is set.

  agentskeptic decision-bundle validate <dir>
  Validates decision evidence bundle layout and completeness. Stdout: one JSON line. Exit 0 complete, 1 partial, 2 invalid, 3 operational.

  verify-bundle-signature --run-dir <dir> --public-key <path>
  Verify signed bundle (Ed25519 + manifest v2). Exit 0 if valid; exit 3 with JSON envelope on failure.

  agentskeptic execution-identity verify --expect-json <path>
  Compare pinned JSON to dist/execution-identity.v1.json ($schema ignored in compare).

  agentskeptic debug --corpus <dir> [--port <n>]
  Local Debug Console on 127.0.0.1 (see docs/agentskeptic.md — Debug Console).

  agentskeptic plan-transition --repo <dir> --before <ref> --after <ref> --plan <path>
  Validate git Before..After against machine plan rules (planValidation, body YAML section, or derived path citations as required diff surfaces; Git >= 2.30.0; see docs).

  --help, -h  print this message and exit 0`;
}

function usageCurrentCommand(): string {
  return `Usage:
  agentskeptic usage [--json]

Shows current commercial quota usage from GET /api/v1/usage/current.

Exit codes:
  0  success
  3  operational failure (stderr: JSON envelope)

  --help, -h  print this message and exit 0`;
}

function usageVerifyIntegratorOwned(): string {
  return `Usage:
  agentskeptic verify-integrator-owned --workflow-id <id> --events <path> --registry <path> --db <sqlitePath>
  agentskeptic verify-integrator-owned --workflow-id <id> --events <path> --registry <path> --postgres-url <url>

  Same flags and verification semantics as contract batch verify, except paths classified as bundled_examples are rejected (exit 2; stderr: INTEGRATOR_OWNED_GATE).

  See docs/agentskeptic.md (Integrator-owned gate).

  --help, -h  print this message and exit 0`;
}

function usageExecutionTrace(): string {
  return `Usage:
  agentskeptic execution-trace --workflow-id <id> --events <path> [--workflow-result <path>] [--format json|text]

Exit codes:
  0  success (stdout: ExecutionTraceView JSON or text; stderr empty)
  3  operational failure (stderr: JSON envelope only; stdout empty)

  --help, -h  print this message and exit 0`;
}

function usageEmitLint(): string {
  return `Usage:
  agentskeptic emit-lint --workflow-id <id> --events <path>

Checks emitter-quality invariants before verification:
  - event schema validity (via shared loader)
  - runEventId uniqueness and parentRunEventId ordering/referential integrity
  - workflow-scoped tool_observed presence
  - malformed line count == 0

Exit codes:
  0  pass
  3  operational failure (stderr: JSON envelope)

  --help, -h  print this message and exit 0`;
}

function assertExecutionTraceArgsWellFormed(args: string[]): void {
  const allowed = new Set([
    "--workflow-id",
    "--events",
    "--workflow-result",
    "--format",
    "--help",
    "-h",
  ]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-h" || a === "--help") continue;
    if (!a.startsWith("--")) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.EXECUTION_TRACE_USAGE,
        `Unexpected argument: ${a}`,
      );
    }
    if (!allowed.has(a)) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.EXECUTION_TRACE_USAGE,
        `Unknown option: ${a}`,
      );
    }
    if (a === "--workflow-id" || a === "--events" || a === "--workflow-result" || a === "--format") {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) {
        throw new TruthLayerError(
          CLI_OPERATIONAL_CODES.EXECUTION_TRACE_USAGE,
          `Missing value after ${a}.`,
        );
      }
      i++;
    }
  }
}

function runExecutionTraceSubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageExecutionTrace());
    process.exit(0);
  }

  try {
    assertExecutionTraceArgsWellFormed(args);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const workflowId = argValue(args, "--workflow-id");
  const eventsPath = argValue(args, "--events");
  const workflowResultPath = argValue(args, "--workflow-result");
  const formatRaw = argValue(args, "--format") ?? "json";
  if (formatRaw !== "json" && formatRaw !== "text") {
    writeCliError(
      CLI_OPERATIONAL_CODES.EXECUTION_TRACE_USAGE,
      '--format must be "json" or "text".',
    );
    process.exit(3);
  }

  if (!workflowId || !eventsPath) {
    writeCliError(
      CLI_OPERATIONAL_CODES.EXECUTION_TRACE_USAGE,
      "Missing required --workflow-id or --events path.",
    );
    process.exit(3);
  }

  let load;
  try {
    load = loadEventsForWorkflow(eventsPath, workflowId);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }

  let workflowResult: WorkflowResult | undefined;
  if (workflowResultPath) {
    let raw: string;
    try {
      raw = readFileSync(workflowResultPath, "utf8");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.COMPARE_INPUT_READ_FAILED, formatOperationalMessage(msg));
      process.exit(3);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.COMPARE_INPUT_JSON_SYNTAX, formatOperationalMessage(msg));
      process.exit(3);
    }
    try {
      workflowResult = normalizeToEmittedWorkflowResult(
        parsed as WorkflowEngineResult | WorkflowResult,
      );
    } catch (e) {
      if (e instanceof TruthLayerError) {
        writeCliError(e.code, e.message);
        process.exit(3);
      }
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
      process.exit(3);
    }
  }

  let view;
  try {
    view = buildExecutionTraceView({
      workflowId,
      runEvents: load.runEvents,
      malformedEventLineCount: load.malformedEventLineCount,
      workflowResult,
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }

  const validateTrace = loadSchemaValidator("execution-trace-view");
  if (!validateTrace(view)) {
    writeCliError(
      CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      JSON.stringify(validateTrace.errors ?? []),
    );
    process.exit(3);
  }

  if (formatRaw === "text") {
    process.stdout.write(formatExecutionTraceText(view));
  } else {
    console.log(JSON.stringify(view));
  }
  process.exit(0);
}

function runEmitLintSubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageEmitLint());
    process.exit(0);
  }
  const workflowId = argValue(args, "--workflow-id");
  const eventsPath = argValue(args, "--events");
  if (!workflowId || !eventsPath) {
    writeCliError(
      CLI_OPERATIONAL_CODES.EMIT_LINT_USAGE,
      "emit-lint requires --workflow-id <id> and --events <path>.",
    );
    process.exit(3);
  }
  try {
    const load = loadEventsForWorkflow(eventsPath, workflowId);
    if (load.malformedEventLineCount > 0) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.EMIT_LINT_FAILED,
        `Malformed event lines detected: ${String(load.malformedEventLineCount)}.`,
      );
    }
    assertValidRunEventParentGraph(load.runEvents);
    if (load.events.length === 0) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.EMIT_LINT_FAILED,
        "No schema-valid tool_observed events found for workflow in emit-lint input.",
      );
    }
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        workflowId,
        runEventCount: load.runEvents.length,
        toolObservedCount: load.events.length,
      })}\n`,
    );
    process.exit(0);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.EMIT_LINT_FAILED, formatOperationalMessage(msg));
    process.exit(3);
  }
}

function usageCompare(): string {
  return `Usage:
  agentskeptic compare --manifest <compare-run-manifest.json>

  Manifest schema: schemas/compare-run-manifest-v1.schema.json.
  Success: stdout is UTF-8 RegressionArtifactV1 JSON (sorted keys); stderr is artifact.humanText only.

Exit codes:
  0  comparison succeeded
  3  operational failure (stderr: JSON envelope only; stdout empty)

  --help, -h  print this message and exit 0`;
}

function writeCliError(code: string, message: string): void {
  console.error(cliErrorEnvelope(code, message));
}

function usageAssurance(): string {
  return `Usage:
  agentskeptic assurance run --manifest <path> [--write-report <path>]
  agentskeptic assurance stale --report <path> --max-age-hours <n>

  assurance run executes each manifest scenario by spawning this CLI (schemas/assurance-manifest-v1.schema.json).
  Path arguments in each scenario argv are resolved relative to the manifest file's directory unless absolute.
  Successful stdout is a single JSON line: schemas/assurance-output-v1.schema.json (kind assurance_run) with
  embedded runReport (schemas/assurance-run-report-v1.schema.json). Scenario spawn wall time is capped by
  AGENTSKEPTIC_ASSURANCE_SCENARIO_TIMEOUT_MS (default 900000 ms); timed-out scenarios record exitCode 124.

  assurance stale exits 1 when the report issuedAt is older than max-age-hours (UTC wall clock).
  Successful stdout is one JSON line (kind assurance_stale). issuedAt more than ~5 minutes in the future
  is exit 3 (ASSURANCE_REPORT_ISSUED_AT_FUTURE_SKEW). Human stale stderr is not used.

Exit codes (run):
  0  all scenarios exited 0
  1  at least one scenario non-zero
  3  operational failure (stderr: JSON envelope)

Exit codes (stale):
  0  report fresh
  1  report stale
  3  missing/invalid report (stderr: JSON envelope)

  --help, -h  print this message and exit 0`;
}

function runAssuranceSubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageAssurance());
    process.exit(0);
  }
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "run") {
    const manifestPath = argValue(rest, "--manifest");
    const writeReport = argValue(rest, "--write-report");
    if (!manifestPath) {
      writeCliError(
        CLI_OPERATIONAL_CODES.ASSURANCE_USAGE,
        "assurance run requires --manifest <path>.",
      );
      process.exit(3);
    }
    const res = runAssuranceFromManifest(path.resolve(manifestPath));
    if (!res.ok) {
      writeCliError(res.code, res.message);
      process.exit(3);
    }
    let line: string;
    try {
      line = validateAndSerializeAssuranceOutput(buildAssuranceRunOutput(res.report));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(`assurance output: ${msg}`));
      process.exit(3);
    }
    try {
      process.stdout.write(line);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(`stdout: ${msg}`));
      process.exit(3);
    }
    if (writeReport !== undefined) {
      try {
        atomicWriteUtf8File(path.resolve(writeReport), line);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        writeCliError(
          CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
          formatOperationalMessage(`write-report: ${msg}`),
        );
        process.exit(3);
      }
    }
    process.exit(res.exitCode);
  }
  if (sub === "stale") {
    const reportPath = argValue(rest, "--report");
    const maxH = argValue(rest, "--max-age-hours");
    if (!reportPath || maxH === undefined) {
      writeCliError(
        CLI_OPERATIONAL_CODES.ASSURANCE_STALE_USAGE,
        "assurance stale requires --report <path> and --max-age-hours <n>.",
      );
      process.exit(3);
    }
    const hours = Number(maxH);
    if (!Number.isFinite(hours) || hours < 0) {
      writeCliError(
        CLI_OPERATIONAL_CODES.ASSURANCE_STALE_USAGE,
        "--max-age-hours must be a non-negative number.",
      );
      process.exit(3);
    }
    const st = checkAssuranceReportStale(path.resolve(reportPath), hours);
    if (st.kind === "operational") {
      writeCliError(st.code, st.message);
      process.exit(3);
    }
    let staleLine: string;
    try {
      staleLine = validateAndSerializeAssuranceOutput(
        buildAssuranceStaleOutput({
          fresh: st.kind === "fresh",
          issuedAt: st.issuedAt,
          ageMs: st.ageMs,
          maxAgeHours: st.maxAgeHours,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(`assurance output: ${msg}`));
      process.exit(3);
    }
    try {
      process.stdout.write(staleLine);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(`stdout: ${msg}`));
      process.exit(3);
    }
    process.exit(st.kind === "fresh" ? 0 : 1);
  }
  writeCliError(
    CLI_OPERATIONAL_CODES.ASSURANCE_USAGE,
    "Use agentskeptic assurance run or agentskeptic assurance stale.",
  );
  process.exit(3);
}

async function runQuickSubcommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageQuick());
    process.exit(0);
  }
  if (argValue(args, "--expect-lock") !== undefined || argValue(args, "--output-lock") !== undefined) {
    writeCliError(
      CLI_OPERATIONAL_CODES.ENFORCE_USAGE,
      "Lock flags are removed. Use `agentskeptic verify` for stateless checks or `agentskeptic enforce` for stateful CI enforcement.",
    );
    exitAfterVerifyCliReceipt({
      parsedBatch: null,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.ENFORCE_USAGE,
    });
  }
  let pq;
  try {
    pq = parseQuickCliArgs(args);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      exitAfterVerifyCliReceipt({
        parsedBatch: null,
        certificate: null,
        exitCode: 3,
        operationalCode: e.code,
      });
    }
    throw e;
  }
  const {
    inputPath,
    exportPath,
    emitEventsPath,
    workflowIdQuick,
    dbPath,
    postgresUrl,
    shareReportOrigin,
    noHumanReport,
    writeDecisionBundleDir,
    decisionAttestationPath,
    decisionNextActionPath,
  } = pq;
  const activationRunId =
    process.env.AGENTSKEPTIC_RUN_ID?.trim() ||
    process.env.WORKFLOW_VERIFIER_RUN_ID?.trim() ||
    randomUUID();
  const quickHttpCorrelationId = newActivationHttpCorrelationId();
  let quickPreflight: { runId: string | null };
  try {
    quickPreflight = await runLicensePreflightIfNeeded("verify", {
      runId: activationRunId,
      xRequestId: quickHttpCorrelationId,
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      exitAfterQuickVerifyReceipt({
        quick: pq,
        certificate: null,
        exitCode: 3,
        operationalCode: e.code,
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    exitAfterQuickVerifyReceipt({
      quick: pq,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
    });
  }
  let inputUtf8: string;
  try {
    inputUtf8 = inputPath === "-" ? readFileSync(0, "utf8") : readFileSync(path.resolve(inputPath), "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, `Cannot read --input: ${msg}`);
    exitAfterQuickVerifyReceipt({
      quick: pq,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.CLI_USAGE,
    });
  }
  const quickBuildProfile = LICENSE_PREFLIGHT_ENABLED ? ("commercial" as const) : ("oss" as const);
  const quickWorkloadClass = classifyQuickVerifyWorkload({
    inputPath: inputPath,
    sqlitePath: dbPath ?? undefined,
    postgresUrl: postgresUrl ?? undefined,
  });
  const quickLineage = classifyWorkflowLineage({
    subcommand: "quick_verify",
    workloadClass: quickWorkloadClass,
  });
  await postProductActivationEvent({
    phase: "verify_started",
    run_id: activationRunId,
    issued_at: new Date().toISOString(),
    workload_class: quickWorkloadClass,
    workflow_lineage: quickLineage,
    subcommand: "quick_verify",
    build_profile: quickBuildProfile,
  });
  let registryUtf8: string;
  let report: QuickVerifyReport;
  let contractExports: QuickContractExport[] = [];
  try {
    const out = await runQuickVerifyToValidatedReport({
      inputUtf8,
      postgresUrl: postgresUrl ?? undefined,
      sqlitePath: dbPath ?? undefined,
    });
    report = out.report;
    registryUtf8 = out.registryUtf8;
    contractExports = out.contractExports;
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      exitAfterQuickVerifyReceipt({
        quick: pq,
        certificate: null,
        exitCode: 3,
        operationalCode: e.code,
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    exitAfterQuickVerifyReceipt({
      quick: pq,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
    });
  }
  await postProductActivationEvent({
    phase: "verify_outcome",
    run_id: activationRunId,
    issued_at: new Date().toISOString(),
    workload_class: quickWorkloadClass,
    workflow_lineage: quickLineage,
    subcommand: "quick_verify",
    build_profile: quickBuildProfile,
    terminal_status: quickVerifyVerdictToTerminalStatus(report.verdict),
  });
  try {
    atomicWriteUtf8File(path.resolve(exportPath), registryUtf8);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(`export-registry: ${msg}`));
    exitAfterQuickVerifyReceipt({
      quick: pq,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
    });
  }
  if (emitEventsPath !== undefined) {
    const eventsUtf8 = buildQuickContractEventsNdjson({
      workflowId: workflowIdQuick,
      exports: contractExports,
    });
    try {
      atomicWriteUtf8File(path.resolve(emitEventsPath), eventsUtf8);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(`emit-events: ${msg}`));
      exitAfterQuickVerifyReceipt({
        quick: pq,
        certificate: null,
        exitCode: 3,
        operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      });
    }
  }
  const quickHumanOpts = {
    workflowId: workflowIdQuick,
    eventsPath: emitEventsPath !== undefined ? emitEventsPath : undefined,
    registryPath: exportPath,
    dbFlag: dbPath ?? undefined,
    postgresUrl: postgresUrl !== undefined,
  };
  const certificate = buildOutcomeCertificateFromQuickReport({
    report,
    workflowId: workflowIdQuick,
    humanReportOptions: quickHumanOpts,
  });
  if (writeDecisionBundleDir !== undefined) {
    try {
      let attestation: unknown | undefined;
      let nextAction: unknown | undefined;
      if (decisionAttestationPath !== undefined) {
        attestation = JSON.parse(readFileSync(path.resolve(decisionAttestationPath), "utf8")) as unknown;
      }
      if (decisionNextActionPath !== undefined) {
        nextAction = JSON.parse(readFileSync(path.resolve(decisionNextActionPath), "utf8")) as unknown;
      }
      writeDecisionEvidenceBundle({
        outDir: writeDecisionBundleDir,
        certificate,
        noHumanReport,
        runId: activationRunId,
        ...(attestation !== undefined ? { attestation } : {}),
        ...(nextAction !== undefined ? { nextAction } : {}),
      });
    } catch (e) {
      if (e instanceof TruthLayerError) {
        writeCliError(e.code, e.message);
        exitAfterQuickVerifyReceipt({
          quick: pq,
          certificate: null,
          exitCode: 3,
          operationalCode: e.code,
        });
      }
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
      exitAfterQuickVerifyReceipt({
        quick: pq,
        certificate: null,
        exitCode: 3,
        operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      });
    }
  }
  if (shareReportOrigin !== undefined) {
    const shareRes = await postPublicVerificationReport(shareReportOrigin, {
      schemaVersion: 2,
      certificate,
    });
    if (!shareRes.ok) {
      writeCliError(
        CLI_OPERATIONAL_CODES.SHARE_REPORT_FAILED,
        formatOperationalMessage(
          `share_report_origin=${shareReportOrigin} http_status=${String(shareRes.status)} detail=${shareRes.bodySnippet}`,
        ),
      );
      exitAfterQuickVerifyReceipt({
        quick: pq,
        certificate: null,
        exitCode: 3,
        operationalCode: CLI_OPERATIONAL_CODES.SHARE_REPORT_FAILED,
      });
    }
  }
  try {
    writeSync(1, `${stableStringify(certificate)}\n`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(`stdout: ${msg}`));
    exitAfterQuickVerifyReceipt({
      quick: pq,
      certificate: null,
      exitCode: 3,
      operationalCode: CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
    });
  }
  if (!noHumanReport) {
    console.error(certificate.humanReport);
    process.stderr.write(formatDistributionFooter());
  }
  await maybeEmitOssClaimTicketUrlToStderr({
    run_id: activationRunId,
    terminal_status: quickVerifyVerdictToTerminalStatus(report.verdict),
    workload_class: quickWorkloadClass,
    subcommand: "quick_verify",
    build_profile: quickBuildProfile,
    xRequestId: quickHttpCorrelationId,
  });
  await postVerifyOutcomeBeacon({
    runId: quickPreflight.runId,
    certificate,
    terminal_status: quickVerifyVerdictToTerminalStatus(report.verdict),
    workload_class: quickWorkloadClass,
    subcommand: "quick_verify",
    xRequestId: quickHttpCorrelationId,
  });
  if (report.verdict === "pass") {
    exitAfterQuickVerifyReceipt({
      quick: pq,
      certificate,
      exitCode: 0,
      operationalCode: null,
    });
  }
  if (report.verdict === "fail") {
    exitAfterQuickVerifyReceipt({
      quick: pq,
      certificate,
      exitCode: 1,
      operationalCode: null,
    });
  }
  exitAfterQuickVerifyReceipt({
    quick: pq,
    certificate,
    exitCode: 2,
    operationalCode: null,
  });
}

function runVerifyBundleSignatureSubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage:
  agentskeptic verify-bundle-signature --run-dir <dir> --public-key <path>

Exit codes:
  0  signature and manifest integrity OK
  3  verification failed (stderr: JSON envelope; code is BUNDLE_SIGNATURE_*)

  --help, -h  print this message and exit 0`);
    process.exit(0);
  }
  const runDir = argValue(args, "--run-dir");
  const publicKeyPath = argValue(args, "--public-key");
  if (!runDir || !publicKeyPath) {
    writeCliError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "verify-bundle-signature requires --run-dir and --public-key.",
    );
    process.exit(3);
  }
  const r = verifyRunBundleSignature(runDir, publicKeyPath);
  if (r.ok) {
    process.exit(0);
  }
  writeCliError(r.code, r.message);
  process.exit(3);
}

function usageValidateRegistry(): string {
  return `Usage:
  agentskeptic validate-registry --registry <path>
  agentskeptic validate-registry --registry <path> --events <path> --workflow-id <id>

Exit codes:
  0  registry valid (stdout: RegistryValidationResult JSON; stderr empty)
  1  validation failed (stdout: RegistryValidationResult JSON; stderr human report)
  3  operational failure (stderr JSON envelope only; stdout empty)

Options: --registry (required), --events and --workflow-id (both or neither).

  --help, -h  print this message and exit 0`;
}

function assertValidateRegistryArgsWellFormed(args: string[]): void {
  const allowed = new Set(["--registry", "--events", "--workflow-id", "--help", "-h"]);
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-h" || a === "--help") continue;
    if (!a.startsWith("--")) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.VALIDATE_REGISTRY_USAGE,
        `Unexpected argument: ${a}`,
      );
    }
    if (!allowed.has(a)) {
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.VALIDATE_REGISTRY_USAGE,
        `Unknown option: ${a}`,
      );
    }
    if (a === "--registry" || a === "--events" || a === "--workflow-id") {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) {
        throw new TruthLayerError(
          CLI_OPERATIONAL_CODES.VALIDATE_REGISTRY_USAGE,
          `Missing value after ${a}.`,
        );
      }
      i++;
    }
  }
}

function runValidateRegistrySubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageValidateRegistry());
    process.exit(0);
  }

  try {
    assertValidateRegistryArgsWellFormed(args);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const registryPath = argValue(args, "--registry");
  const eventsPath = argValue(args, "--events");
  const workflowId = argValue(args, "--workflow-id");

  if (!registryPath) {
    writeCliError(
      CLI_OPERATIONAL_CODES.VALIDATE_REGISTRY_USAGE,
      "Missing required --registry path.",
    );
    process.exit(3);
  }

  let result;
  try {
    result = validateToolsRegistry({
      registryPath,
      eventsPath,
      workflowId,
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }

  const validateOut = loadSchemaValidator("registry-validation-result");
  if (!validateOut(result)) {
    writeCliError(
      CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      JSON.stringify(validateOut.errors ?? []),
    );
    process.exit(3);
  }

  console.log(JSON.stringify(result));

  if (!result.valid) {
    process.stderr.write(`${formatRegistryValidationHumanReport(result)}\n`);
    process.exit(1);
  }

  process.exit(0);
}

function runCompareSubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageCompare());
    process.exit(0);
  }

  const manifestPath = argValue(args, "--manifest");
  if (!manifestPath) {
    writeCliError(CLI_OPERATIONAL_CODES.COMPARE_USAGE, "compare requires --manifest <path>.");
    process.exit(3);
  }

  let artifact;
  try {
    const built = buildRegressionArtifactFromCompareManifest(manifestPath);
    artifact = built.artifact;
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }

  process.stderr.write(artifact.humanText.endsWith("\n") ? artifact.humanText : `${artifact.humanText}\n`);
  process.stdout.write(`${stringifyRegressionArtifact(artifact)}\n`);
  process.exit(0);
}

function usageDebug(): string {
  return `Usage:
  agentskeptic debug --corpus <dir> [--port <n>]

Serves the Debug Console on 127.0.0.1 only. Each run is a subfolder of the corpus
with workflow-result.json and events.ndjson (see docs/agentskeptic.md).

Exit: Ctrl+C ends the server (exit 0). Port in use or bad corpus → exit 3.

  --help, -h  print this message and exit 0`;
}

async function runDebugSubcommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageDebug());
    process.exit(0);
  }
  const corpus = argValue(args, "--corpus");
  const portRaw = argValue(args, "--port");
  const port = portRaw === undefined ? 8787 : Number(portRaw);
  if (!corpus) {
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, "debug requires --corpus <dir>.");
    process.exit(3);
  }
  if (!Number.isFinite(port) || port < 0 || port > 65535 || !Number.isInteger(port)) {
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, "Invalid --port; use an integer 0–65535 (0 = ephemeral).");
    process.exit(3);
  }
  let st;
  try {
    st = statSync(corpus);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, formatOperationalMessage(msg));
    process.exit(3);
  }
  if (!st.isDirectory()) {
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, "--corpus must be a directory.");
    process.exit(3);
  }
  const resolved = path.resolve(corpus);
  const bundle = loadCorpusBundle(resolved);
  logCorpusLoadErrors(bundle.outcomes);
  let srv;
  try {
    srv = await startDebugServerOnPort(resolved, port);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }
  const url = debugServerEntryUrl(srv.port);
  process.stdout.write(`Debug Console ${url}\n`);
  process.stdout.write(`Corpus ${resolved} (${bundle.outcomes.length} run folders)\n`);
  const onSig = () => {
    void srv.close().then(() => process.exit(0));
  };
  process.on("SIGINT", onSig);
  process.on("SIGTERM", onSig);
}

function usagePlanTransition(): string {
  return `Usage:
  agentskeptic plan-transition --repo <dir> --before <ref> --after <ref> --plan <path>

Optional:
  --workflow-id <id>   (default ${PLAN_TRANSITION_WORKFLOW_ID})
  --no-human-report
  --write-run-bundle <dir>
  --sign-ed25519-private-key <path>   (requires --write-run-bundle)

Requires Git >= 2.30.0. Plan file must start with YAML front matter; rules from front matter planValidation, or from a body section "Repository transition validation", or derived from path citations as required diff surfaces when neither is present (see docs).

Exit codes:
  0  workflow status complete
  1  workflow status inconsistent
  2  workflow status incomplete
  3  operational failure (see stderr JSON)

  --help, -h  print this message and exit 0`;
}

function runPlanTransitionSubcommand(args: string[]): void {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usagePlanTransition());
    process.exit(0);
  }
  const repo = argValue(args, "--repo");
  const beforeRef = argValue(args, "--before");
  const afterRef = argValue(args, "--after");
  const planPath = argValue(args, "--plan");
  if (!repo || !beforeRef || !afterRef || !planPath) {
    writeCliError(
      CLI_OPERATIONAL_CODES.PLAN_TRANSITION_USAGE,
      "plan-transition requires --repo, --before, --after, and --plan.",
    );
    process.exit(3);
  }
  const workflowId = argValue(args, "--workflow-id") ?? PLAN_TRANSITION_WORKFLOW_ID;
  const noHumanReport = args.includes("--no-human-report");
  const writeRunBundleDir = argValue(args, "--write-run-bundle");
  const signPrivateKeyPath = argValue(args, "--sign-ed25519-private-key");
  if (signPrivateKeyPath !== undefined && writeRunBundleDir === undefined) {
    writeCliError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      "--sign-ed25519-private-key requires --write-run-bundle.",
    );
    process.exit(3);
  }

  let result: WorkflowResult;
  let transitionRulesProvenance: TransitionRulesProvenance;
  try {
    const built = buildPlanTransitionWorkflowResult({
      repoRoot: repo,
      beforeRef,
      afterRef,
      planPath,
      workflowId,
    });
    result = built.workflowResult;
    transitionRulesProvenance = built.transitionRulesProvenance;
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeCliError(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const validateResult = loadSchemaValidator("workflow-result");
  if (!validateResult(result)) {
    writeCliError(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      JSON.stringify(validateResult.errors ?? []),
    );
    process.exit(3);
  }

  if (!noHumanReport) {
    const cert = buildOutcomeCertificateFromWorkflowResult(result, "contract_sql");
    process.stderr.write(`${cert.humanReport}\n`);
  }

  if (writeRunBundleDir !== undefined) {
    try {
      const repoResolved = path.resolve(repo);
      const planReal = assertPlanPathInsideRepo(repoResolved, planPath);
      const beforeSha = resolveCommitSha(repoResolved, beforeRef);
      const afterSha = resolveCommitSha(repoResolved, afterRef);
      const planSha = sha256HexOfFile(planReal);
      const eventsNdjson = buildPlanTransitionEventsNdjson({
        workflowId,
        beforeRef,
        afterRef,
        beforeCommitSha: beforeSha,
        afterCommitSha: afterSha,
        planResolvedPath: planReal,
        planSha256: planSha,
        transitionRulesSource: transitionRulesProvenance,
      });
      writeRunBundleCli(writeRunBundleDir, eventsNdjson, result, signPrivateKeyPath);
    } catch (e) {
      if (isBundlePrivateKeyTruthError(e)) {
        writeCliError(e.code, e.message);
        process.exit(3);
      }
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
      process.exit(3);
    }
  }

  console.log(JSON.stringify(result));
  if (result.status === "complete") process.exit(0);
  if (result.status === "inconsistent") process.exit(1);
  process.exit(2);
}

function runDecisionBundleValidateSubcommand(rest: string[]): void {
  if (rest.includes("--help") || rest.includes("-h")) {
    console.log(`Usage:
  agentskeptic decision-bundle validate <dir>

Exit codes:
  0  complete
  1  partial
  2  invalid
  3  operational failure

Stdout: one JSON line (decision_bundle_validation v1).

  --help, -h  print this message and exit 0`);
    process.exit(0);
  }
  const dir = rest[0];
  if (!dir) {
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, "decision-bundle validate requires <dir>.");
    process.exit(3);
  }
  if (rest.length > 1) {
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, "Too many arguments.");
    process.exit(3);
  }
  try {
    const line = validateDecisionEvidenceBundle(dir);
    console.log(formatValidationStdout(line));
    if (line.status === "complete") process.exit(0);
    if (line.status === "partial") process.exit(1);
    process.exit(2);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--version" || args[0] === "-V") {
    console.log(AGENTSKEPTIC_CLI_SEMVER);
    process.exit(0);
  }
  if (args[0] === "decision-bundle") {
    const rest = args.slice(1);
    if (rest[0] === "validate") {
      runDecisionBundleValidateSubcommand(rest.slice(1));
      return;
    }
    writeCliError(CLI_OPERATIONAL_CODES.CLI_USAGE, "Unknown decision-bundle subcommand.");
    process.exit(3);
  }
  if (args[0] === "init") {
    const { runInitCommand } = await import("./cli/initCommand.js");
    runInitCommand(args.slice(1));
    return;
  }
  if (args[0] === "migrate") {
    const { runMigrateCommand } = await import("./cli/migrateCommand.js");
    runMigrateCommand(args.slice(1));
    return;
  }
  if (args[0] === "usage") {
    const rest = args.slice(1);
    if (rest.includes("--help") || rest.includes("-h")) {
      console.log(usageCurrentCommand());
      process.exit(0);
    }
    const asJson = rest.includes("--json");
    try {
      const payload = await fetchCurrentUsage();
      if (asJson) {
        console.log(JSON.stringify(payload));
      } else {
        const included = payload.included_monthly === null ? "unlimited" : String(payload.included_monthly);
        process.stdout.write(
          `Plan: ${payload.plan}\nMonth: ${payload.year_month}\nUsed: ${payload.used_total}\nIncluded: ${included}\nOverage: ${payload.overage_count}\nState: ${payload.quota_state}\nAllowed next: ${payload.allowed_next}\nEstimated overage USD: ${payload.estimated_overage_usd}\n`,
        );
      }
      process.exit(0);
    } catch (e) {
      if (e instanceof TruthLayerError) {
        writeCliError(e.code, e.message);
        process.exit(3);
      }
      const msg = e instanceof Error ? e.message : String(e);
      writeCliError(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
      process.exit(3);
    }
  }
  if (args[0] === "execution-identity") {
    runExecutionIdentityVerifyCli(args.slice(1));
    return;
  }

  if (args[0] === "funnel-anon") {
    await runFunnelAnonCliAndExit(args.slice(1));
    return;
  }
  if (args[0] === "assurance") {
    runAssuranceSubcommand(args.slice(1));
    return;
  }
  if (args[0] === "quick") {
    await runQuickSubcommand(args.slice(1));
    return;
  }
  if (args[0] === "loop") {
    if (args.slice(1).includes("--help") || args.slice(1).includes("-h")) {
      console.log(usageLoop());
      process.exit(0);
    }
    await runLoopSubcommand(args.slice(1));
    return;
  }
  if (args[0] === "crossing") {
    await runCrossingSubcommand(args.slice(1));
    return;
  }
  if (args[0] === "bootstrap") {
    await runBootstrapSubcommand(args.slice(1));
    return;
  }
  if (args[0] === "registry-draft") {
    await runRegistryDraftCliAndExit(args.slice(1));
    return;
  }
  if (args[0] === "verify-bundle-signature") {
    runVerifyBundleSignatureSubcommand(args.slice(1));
    return;
  }
  if (args[0] === "plan-transition") {
    runPlanTransitionSubcommand(args.slice(1));
    return;
  }
  if (args[0] === "debug") {
    await runDebugSubcommand(args.slice(1));
    return;
  }

  if (args[0] === "compare") {
    runCompareSubcommand(args.slice(1));
    return;
  }

  if (args[0] === "execution-trace") {
    runExecutionTraceSubcommand(args.slice(1));
    return;
  }

  if (args[0] === "validate-registry") {
    runValidateRegistrySubcommand(args.slice(1));
    return;
  }
  if (args[0] === "emit-lint") {
    runEmitLintSubcommand(args.slice(1));
    return;
  }

  if (args[0] === "enforce") {
    await runEnforce(args.slice(1));
    return;
  }

  const leadIsIntegratorOwned = args[0] === "verify-integrator-owned";
  const verifyCliArgs = leadIsIntegratorOwned ? args.slice(1) : args;

  if (args.includes("--help") || args.includes("-h")) {
    if (leadIsIntegratorOwned) {
      console.log(usageVerifyIntegratorOwned());
    } else {
      console.log(usageVerify());
    }
    process.exit(0);
  }

  if (argValue(verifyCliArgs, "--expect-lock") !== undefined || argValue(verifyCliArgs, "--output-lock") !== undefined) {
    writeCliError(
      CLI_OPERATIONAL_CODES.ENFORCE_USAGE,
      "Lock flags are removed. Use `agentskeptic enforce` for over-time CI enforcement.",
    );
    process.exit(3);
  }

  await runBatchVerifyWithTelemetrySubcommand(verifyCliArgs, {
    telemetrySubcommand: leadIsIntegratorOwned ? "verify_integrator_owned" : "batch_verify",
    rejectBundled: leadIsIntegratorOwned,
  });
}

void main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(cliErrorEnvelope(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg)));
  process.exit(3);
});
