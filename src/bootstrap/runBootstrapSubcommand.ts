import path from "node:path";
import { randomUUID } from "node:crypto";
import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { formatOperationalMessage } from "../failureCatalog.js";
import { formatDistributionFooter } from "../distributionFooter.js";
import {
  emitOutcomeCertificateCliAndExitByStateRelation,
  emitVerifyWorkflowCliJsonAndExitByStatus,
} from "../standardVerifyWorkflowCli.js";
import { TruthLayerError } from "../truthLayerError.js";
import {
  cleanupOutDirFromPath,
  executeBootstrapPack,
  writeBootstrapOperationalFailure,
} from "./executeBootstrapPack.js";
import { parseBootstrapCliArgs, type ParsedBootstrapCli } from "./bootstrapCliArgs.js";
import { newActivationHttpCorrelationId } from "../commercial/activationCorrelation.js";
import { runLicensePreflightIfNeeded } from "../commercial/licensePreflight.js";
import { postVerifyOutcomeBeacon } from "../commercial/postVerifyOutcomeBeacon.js";
import { classifyBatchVerifyWorkload } from "../commercial/verifyWorkloadClassify.js";
import { parseVerificationDatabaseUrl } from "../verificationDatabaseUrl.js";
import type { VerificationDatabase } from "../types.js";
import { buildOutcomeCertificateFromWorkflowResult, type OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { loadSchemaValidator } from "../schemaLoad.js";
import { atomicWriteUtf8File } from "../quickVerify/atomicWrite.js";
import { writeContractProofArtifacts } from "../verify/writeContractProofArtifacts.js";
import {
  activationTrustTerminalFromWorkflow,
  activationWireFromManifestDisk,
  buildActivationManifestDisk,
  stderrMachineLineProofExport,
  stderrMachineLinesActivateBeforeProof,
  type ActivationManifestDiskV1,
  type TrustTerminalActivation,
} from "./packActivationStages.js";

function usageBootstrap(): string {
  return `Usage:
  agentskeptic bootstrap --input <path> (--db <sqlitePath> | --postgres-url <url>) --out <path>

Builds a contract pack (events.ndjson, tools.json, quick-report.json, README.bootstrap.md) from
BootstrapPackInput v1 JSON + read-only SQL, then replays contract verify in-process.

Exit codes:
  0  Quick pass with exports and contract verify complete (stdout: bootstrap result envelope; stderr empty)
  1  contract verify inconsistent (stdout/stderr: same as agentskeptic verify)
  2  Quick not pass / no exports / contract verify incomplete (stderr: JSON envelope for quick-path; else same as verify)
  3  operational failure (stderr: JSON envelope)

  --help, -h  print this message and exit 0

Normative: docs/bootstrap-pack-normative.md`;
}

function usageActivate(): string {
  return `Usage:
  agentskeptic activate --input <path> (--db <sqlitePath> | --postgres-url <url>) --out <path>

Canonical activation: BootstrapPackInput v1 JSON + read-only database URL, provisional inference + contract replay,
writes exportable proof under <out>/proof/ (technical run bundle, decision bundle, activation.manifest.json) on exits 0–2.

Legacy compatibility verb: agentskeptic bootstrap (same workflow pack build; no proof/ subtree).

Exit codes:
  0  Trusted contract-complete (trustTerminal decision_ready manifest; stdout activate envelope unless verify stdout mode)
  1  inconsistent (trustTerminal contract_inconsistent; stderr machine activation lines then verify-style stderr)
  2  incomplete (trustTerminal contract_incomplete)
  2–3  Quick/pack-stage failures identical to bootstrap (activate-only row: provisional_blocked machine stderr line prefix)
  3  Operational failure without outcome certificate path (stderr JSON envelope; no activation machine lines)

  --help, -h  print this message and exit 0

Normative: docs/bootstrap-pack-normative.md`;
}

function bootstrapDatabase(parsed: ParsedBootstrapCli): VerificationDatabase {
  return parsed.postgresUrl
    ? parseVerificationDatabaseUrl(parsed.postgresUrl, process.cwd())
    : parseVerificationDatabaseUrl(parsed.dbPath!, process.cwd());
}

function terminalStatusFromCertificate(
  certificate: OutcomeCertificateV1,
): "complete" | "inconsistent" | "incomplete" {
  if (certificate.stateRelation === "matches_expectations") return "complete";
  if (certificate.stateRelation === "does_not_match") return "inconsistent";
  return "incomplete";
}

function shouldEmitActivationProvisionalBlockedLine(code: string, message: string): boolean {
  if (
    code === CLI_OPERATIONAL_CODES.BOOTSTRAP_QUICK_NOT_PASS ||
    code === CLI_OPERATIONAL_CODES.BOOTSTRAP_NO_EXPORTABLE_TOOLS ||
    code === CLI_OPERATIONAL_CODES.BOOTSTRAP_NO_TOOL_CALLS ||
    code === CLI_OPERATIONAL_CODES.BOOTSTRAP_TOOL_CALL_ARGUMENTS_INVALID
  ) {
    return true;
  }
  if (code === CLI_OPERATIONAL_CODES.INTERNAL_ERROR && message.includes("pack write")) {
    return true;
  }
  return false;
}

function validateCertificateOrExit(certificate: OutcomeCertificateV1): void {
  const validateCert = loadSchemaValidator("outcome-certificate-v3");
  if (!validateCert(certificate)) {
    writeBootstrapOperationalFailure(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      JSON.stringify(validateCert.errors ?? []),
    );
    process.exit(3);
  }
}

function writeActivationManifestAtomic(proofRoot: string, manifest: ActivationManifestDiskV1): void {
  const validateMan = loadSchemaValidator("activation-manifest-v1");
  const asUnknown = manifest as unknown;
  if (!validateMan(asUnknown)) {
    writeBootstrapOperationalFailure(
      CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      formatOperationalMessage(`activation manifest invalid ${JSON.stringify(validateMan.errors ?? [])}`),
    );
    process.exit(3);
  }
  atomicWriteUtf8File(path.join(proofRoot, "activation.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function finalizeActivateTrustedExit(args: {
  parsed: ParsedBootstrapCli;
  preflightRunId: string | null;
  xRequestId: string;
  workflowId: string;
  eventsPath: string;
  registryPath: string;
  outResolved: string;
  exportedToolCount: number;
  workflowResult: import("../types.js").WorkflowResult;
  trustTerminal: TrustTerminalActivation;
  humanStderrVerifyStyle: boolean;
  truthBuffered: string | undefined;
}): Promise<void> {
  const {
    parsed,
    preflightRunId,
    xRequestId,
    workflowId,
    eventsPath,
    registryPath,
    outResolved,
    exportedToolCount,
    workflowResult,
    trustTerminal,
    humanStderrVerifyStyle,
    truthBuffered,
  } = args;

  const certificate = buildOutcomeCertificateFromWorkflowResult(workflowResult, "contract_sql");
  validateCertificateOrExit(certificate);

  process.stderr.write(stderrMachineLinesActivateBeforeProof(trustTerminal));

  const proofRoot = path.join(outResolved, "proof");
  const proofRunDir = path.join(proofRoot, "run");
  const proofDecisionDir = path.join(proofRoot, "decision");

  writeContractProofArtifacts({
    proofRunDir,
    proofDecisionDir,
    eventsPath,
    workflowResult,
    certificate,
    runBundleSignKeyPath: undefined,
  });

  process.stderr.write(stderrMachineLineProofExport(trustTerminal));

  const manifestDisk = buildActivationManifestDisk(workflowId, trustTerminal);
  writeActivationManifestAtomic(proofRoot, manifestDisk);
  const activationWire = activationWireFromManifestDisk(manifestDisk);

  const workloadClass = classifyBatchVerifyWorkload({
    eventsPath,
    registryPath,
    database: bootstrapDatabase(parsed),
  });
  await postVerifyOutcomeBeacon({
    runId: preflightRunId,
    certificate,
    terminal_status: terminalStatusFromCertificate(certificate),
    workload_class: workloadClass,
    subcommand: "activate",
    activation: activationWire,
    xRequestId,
  });

  if (humanStderrVerifyStyle && truthBuffered !== undefined && truthBuffered.length > 0) {
    process.stderr.write(`${truthBuffered}\n`);
    process.stderr.write(formatDistributionFooter());
  }

  if (trustTerminal === "decision_ready") {
    const envelope = {
      schemaVersion: 1,
      kind: "agentskeptic_activate_result",
      workflowId,
      outDir: outResolved,
      quickVerdict: "pass",
      verifyStatus: "complete",
      exportedToolCount,
    };
    try {
      process.stdout.write(`${JSON.stringify(envelope)}\n`);
    } catch (e) {
      cleanupOutDirFromPath(outResolved);
      const msg = e instanceof Error ? e.message : String(e);
      writeBootstrapOperationalFailure(
        CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
        formatOperationalMessage(`stdout: ${msg}`),
      );
      process.exit(3);
    }
    process.exit(0);
    return;
  }

  emitVerifyWorkflowCliJsonAndExitByStatus(workflowResult, {
    consoleLog: (line) => {
      console.log(line);
    },
    exit: (code: number): void => {
      process.exit(code);
    },
  });
}

export type { ParsedBootstrapCli };
export { parseBootstrapCliArgs } from "./bootstrapCliArgs.js";

export async function runActivateSubcommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageActivate());
    process.exit(0);
  }

  let parsed: ParsedBootstrapCli;
  try {
    parsed = parseBootstrapCliArgs(args);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeBootstrapOperationalFailure(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const activationCorrelationId = newActivationHttpCorrelationId();
  const activationRunId =
    process.env.AGENTSKEPTIC_RUN_ID?.trim() ||
    process.env.WORKFLOW_VERIFIER_RUN_ID?.trim() ||
    randomUUID();

  let preflight: { runId: string | null };
  try {
    preflight = await runLicensePreflightIfNeeded("verify", {
      runId: activationRunId,
      xRequestId: activationCorrelationId,
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeBootstrapOperationalFailure(e.code, e.message);
      process.exit(3);
    }
    const msg = e instanceof Error ? e.message : String(e);
    writeBootstrapOperationalFailure(CLI_OPERATIONAL_CODES.INTERNAL_ERROR, formatOperationalMessage(msg));
    process.exit(3);
  }

  const outcome = await executeBootstrapPack(parsed, { preflight: "caller_reserved" });

  if (outcome.kind === "bootstrap_cli_error") {
    if (shouldEmitActivationProvisionalBlockedLine(outcome.code, outcome.message)) {
      process.stderr.write(`AGENTSKEPTIC_ACTIVATION stage=provisional_infer trust_terminal=blocked\n`);
    }
    writeBootstrapOperationalFailure(outcome.code, outcome.message);
    process.exit(outcome.exitCode);
    return;
  }

  if (outcome.kind === "pack_ready") {
    await finalizeActivateTrustedExit({
      parsed,
      preflightRunId: preflight.runId,
      xRequestId: activationCorrelationId,
      workflowId: outcome.workflowId,
      eventsPath: outcome.eventsPath,
      registryPath: outcome.registryPath,
      outResolved: outcome.outResolved,
      exportedToolCount: outcome.exportedToolCount,
      workflowResult: outcome.workflowResult,
      trustTerminal: activationTrustTerminalFromWorkflow(outcome.workflowResult),
      humanStderrVerifyStyle: false,
      truthBuffered: undefined,
    });
    return;
  }

  await finalizeActivateTrustedExit({
    parsed,
    preflightRunId: preflight.runId,
    xRequestId: activationCorrelationId,
    workflowId: outcome.result.workflowId,
    eventsPath: path.join(outcome.outResolved, "events.ndjson"),
    registryPath: path.join(outcome.outResolved, "tools.json"),
    outResolved: outcome.outResolved,
    exportedToolCount: 0,
    workflowResult: outcome.result,
    trustTerminal: activationTrustTerminalFromWorkflow(outcome.result),
    humanStderrVerifyStyle: true,
    truthBuffered: outcome.truthBuffered,
  });
}

export async function runBootstrapSubcommand(args: string[]): Promise<void> {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usageBootstrap());
    process.exit(0);
  }

  let parsed: ParsedBootstrapCli;
  try {
    parsed = parseBootstrapCliArgs(args);
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeBootstrapOperationalFailure(e.code, e.message);
      process.exit(3);
    }
    throw e;
  }

  const outcome = await executeBootstrapPack(parsed);
  if (outcome.kind === "pack_ready") {
    const envelope = {
      schemaVersion: 1,
      kind: "agentskeptic_bootstrap_result",
      workflowId: outcome.workflowId,
      outDir: outcome.outResolved,
      quickVerdict: "pass",
      verifyStatus: "complete",
      exportedToolCount: outcome.exportedToolCount,
    };
    try {
      process.stdout.write(`${JSON.stringify(envelope)}\n`);
    } catch (e) {
      cleanupOutDirFromPath(outcome.outResolved);
      const msg = e instanceof Error ? e.message : String(e);
      writeBootstrapOperationalFailure(
        CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
        formatOperationalMessage(`stdout: ${msg}`),
      );
      process.exit(3);
    }
    process.exit(0);
    return;
  }

  if (outcome.kind === "bootstrap_cli_error") {
    writeBootstrapOperationalFailure(outcome.code, outcome.message);
    process.exit(outcome.exitCode);
    return;
  }

  process.stderr.write(`${outcome.truthBuffered}\n`);
  process.stderr.write(formatDistributionFooter());
  emitVerifyWorkflowCliJsonAndExitByStatus(outcome.result, {
    consoleLog: (line) => {
      console.log(line);
    },
    exit: (code: number): void => {
      process.exit(code);
    },
  });
}
