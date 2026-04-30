import { randomUUID } from "node:crypto";
import type { ParsedBatchVerifyCli, ParsedQuickCli } from "./cliArgv.js";
import { parseBatchVerifyCliArgs, parseQuickCliArgs } from "./cliArgv.js";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { exitAfterEnforceCliReceipt } from "./cliExecutionFinalize.js";
import { cliErrorEnvelope, formatOperationalMessage } from "./failureCatalog.js";
import { canonicalCertificateSha256, materialTruthSha256 } from "./governanceEvidence.js";
import {
  buildOutcomeCertificateFromQuickReport,
  buildOutcomeCertificateFromWorkflowResult,
  type OutcomeCertificateV1,
} from "./outcomeCertificate.js";
import { stableStringify } from "./jsonStableStringify.js";
import { runLicensePreflightIfNeeded } from "./commercial/licensePreflight.js";
import { verifyWorkflow } from "./pipeline.js";
import { runQuickVerifyToValidatedReport } from "./quickVerify/runQuickVerify.js";
import { postEnforcementJson } from "./sdk/transport.js";
import { runBatchVerifyToValidatedResult } from "./standardVerifyWorkflowCli.js";
import { TruthLayerError } from "./truthLayerError.js";

type EnforceMode = "check" | "create-baseline" | "accept-drift";

function parseEnforceMode(args: string[]): EnforceMode {
  const hasCreate = args.includes("--create-baseline");
  const hasAccept = args.includes("--accept-drift");
  if (hasCreate && hasAccept) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.ENFORCE_USAGE,
      "Use at most one of --create-baseline or --accept-drift.",
    );
  }
  if (hasCreate) return "create-baseline";
  if (hasAccept) return "accept-drift";
  return "check";
}

function stripEnforceModeArgs(args: string[]): string[] {
  return args.filter((a) => a !== "--create-baseline" && a !== "--accept-drift");
}

function apiKeyOrThrow(): string {
  const apiKey =
    process.env.AGENTSKEPTIC_API_KEY?.trim() || process.env.WORKFLOW_VERIFIER_API_KEY?.trim();
  if (!apiKey) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.LICENSE_KEY_MISSING,
      "Commercial agentskeptic enforce requires AGENTSKEPTIC_API_KEY.",
    );
  }
  return apiKey;
}

async function postEnforcementState(
  path: "/api/v1/enforcement/baselines" | "/api/v1/enforcement/check" | "/api/v1/enforcement/accept",
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown; requestId: string | null }> {
  const apiKey = apiKeyOrThrow();
  return postEnforcementJson({ path, payload, apiKey });
}

function writeOperationalErr(code: string, message: string): void {
  console.error(cliErrorEnvelope(code, formatOperationalMessage(message)));
}

export async function runStatefulEnforce(args: string[]): Promise<void> {
  let parsedBatch: ParsedBatchVerifyCli | null = null;
  let pq: ParsedQuickCli | null = null;
  let certificate: OutcomeCertificateV1 | null = null;

  try {
    const mode = parseEnforceMode(args);
    const stripped = stripEnforceModeArgs(args);
    const isQuick =
      stripped.includes("--input") ||
      stripped.includes("--export-registry") ||
      stripped.includes("--emit-events");

    const runId =
      process.env.AGENTSKEPTIC_RUN_ID?.trim() ||
      process.env.WORKFLOW_VERIFIER_RUN_ID?.trim() ||
      randomUUID();
    await runLicensePreflightIfNeeded("enforce", { runId, xRequestId: randomUUID() });

    let terminalStatus: "complete" | "inconsistent" | "incomplete";
    let workflowId: string;
    if (isQuick) {
      const q = parseQuickCliArgs(stripped);
      pq = q;
      const out = await runQuickVerifyToValidatedReport({
        inputUtf8:
          q.inputPath === "-"
            ? await new Promise<string>((resolve, reject) => {
                let s = "";
                process.stdin.setEncoding("utf8");
                process.stdin.on("data", (d) => {
                  s += d;
                });
                process.stdin.on("end", () => resolve(s));
                process.stdin.on("error", reject);
              })
            : await import("node:fs/promises").then((m) => m.readFile(q.inputPath, "utf8")),
        postgresUrl: q.postgresUrl ?? undefined,
        sqlitePath: q.dbPath ?? undefined,
      });
      workflowId = q.workflowIdQuick;
      certificate = buildOutcomeCertificateFromQuickReport({
        report: out.report,
        workflowId: q.workflowIdQuick,
        humanReportOptions: {
          workflowId: q.workflowIdQuick,
          eventsPath: q.emitEventsPath ?? undefined,
          registryPath: q.exportPath,
          dbFlag: q.dbPath ?? undefined,
          postgresUrl: q.postgresUrl !== undefined,
        },
      });
      terminalStatus =
        out.report.verdict === "pass" ? "complete"
        : out.report.verdict === "fail" ? "inconsistent"
        : "incomplete";
    } else {
      const parsed = parseBatchVerifyCliArgs(stripped);
      parsedBatch = parsed;
      const wf = await runBatchVerifyToValidatedResult(() =>
        verifyWorkflow({
          workflowId: parsed.workflowId,
          eventsPath: parsed.eventsPath,
          registryPath: parsed.registryPath,
          database: parsed.database,
          verificationPolicy: parsed.verificationPolicy,
          truthReport: parsed.noHumanReport ? () => {} : (report) => process.stderr.write(`${report}\n`),
        }),
      );
      workflowId = parsed.workflowId;
      certificate = buildOutcomeCertificateFromWorkflowResult(wf, "contract_sql");
      terminalStatus =
        wf.status === "complete" ? "complete"
        : wf.status === "inconsistent" ? "inconsistent"
        : "incomplete";
    }
    const payload: Record<string, unknown> = {
      schema_version: 2,
      run_id: runId,
      workflow_id: workflowId,
      outcome_certificate_v1: certificate,
      material_truth_sha256: materialTruthSha256(certificate),
      certificate_sha256: canonicalCertificateSha256(certificate),
    };

    if (mode === "accept-drift") {
      const expected =
        process.env.AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH?.trim() ||
        process.env.WORKFLOW_VERIFIER_ENFORCE_EXPECTED_PROJECTION_HASH?.trim();
      const verRaw =
        process.env.AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION?.trim() ||
        process.env.WORKFLOW_VERIFIER_ENFORCE_LIFECYCLE_STATE_VERSION?.trim();
      const lifecycle_state_version =
        verRaw !== undefined && verRaw !== "" ? Number.parseInt(verRaw, 10) : NaN;
      if (!expected || !Number.isInteger(lifecycle_state_version)) {
        throw new TruthLayerError(
          CLI_OPERATIONAL_CODES.ENFORCE_USAGE,
          "For --accept-drift, set AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH and AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION from the prior hosted enforce POST /check response (fields expected_projection_hash_for_accept and lifecycle_state_version).",
        );
      }
      payload.expected_projection_hash = expected;
      payload.lifecycle_state_version = lifecycle_state_version;
    }

    const route =
      mode === "create-baseline" ? "/api/v1/enforcement/baselines"
      : mode === "accept-drift" ? "/api/v1/enforcement/accept"
      : "/api/v1/enforcement/check";

    const stateRes = await postEnforcementState(route, payload);
    if (!stateRes.ok) {
      const o =
        typeof stateRes.body === "object" && stateRes.body !== null ?
          (stateRes.body as Record<string, unknown>)
        : {};
      const problemCode =
        typeof o.code === "string" && o.code.trim() ? o.code : `HTTP_${stateRes.status}`;
      const problemHint =
        typeof o.message === "string"
          ? o.message
          : typeof o.detail === "string"
            ? o.detail
            : typeof o.next_action === "string"
              ? o.next_action
              : `HTTP ${stateRes.status}`;
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.LICENSE_DENIED,
        `${problemCode}: ${problemHint}${stateRes.requestId ? ` [x-request-id=${stateRes.requestId}]` : ""}`,
      );
    }

    process.stdout.write(`${stableStringify({ schemaVersion: 2, enforce: stateRes.body })}\n`);

    const resBody =
      typeof stateRes.body === "object" && stateRes.body !== null ?
        (stateRes.body as Record<string, unknown>)
      : {};

    const resultStatus =
      typeof resBody.result_status === "string" ? String(resBody.result_status) : undefined;

    if (route === "/api/v1/enforcement/check" && (resultStatus === "drift" || resultStatus === "rerun_fail")) {
      const msg =
        resultStatus === "rerun_fail" ? "Hosted enforce reported rerun failure against baseline." : "Drift detected.";
      console.error(cliErrorEnvelope(CLI_OPERATIONAL_CODES.VERIFICATION_OUTPUT_LOCK_MISMATCH, msg));
      exitAfterEnforceCliReceipt({
        parsedBatch,
        quick: pq,
        exitCode: 4,
        operationalCode: null,
        certificate,
        enforceExitKindDrift: true,
      });
    }

    /** Legacy envelope (schema_version 1) surfaced `status`; keep for mocks / older gateways. */
    const legacyStatus =
      typeof resBody.status === "string" ? String(resBody.status ?? "ok") : "ok";
    if (legacyStatus === "drift") {
      console.error(cliErrorEnvelope(CLI_OPERATIONAL_CODES.VERIFICATION_OUTPUT_LOCK_MISMATCH, "Drift detected."));
      exitAfterEnforceCliReceipt({
        parsedBatch,
        quick: pq,
        exitCode: 4,
        operationalCode: null,
        certificate,
        enforceExitKindDrift: true,
      });
    }
    if (terminalStatus === "complete") {
      exitAfterEnforceCliReceipt({
        parsedBatch,
        quick: pq,
        exitCode: 0,
        operationalCode: null,
        certificate,
      });
    }
    if (terminalStatus === "inconsistent") {
      exitAfterEnforceCliReceipt({
        parsedBatch,
        quick: pq,
        exitCode: 1,
        operationalCode: null,
        certificate,
      });
    }
    exitAfterEnforceCliReceipt({
      parsedBatch,
      quick: pq,
      exitCode: 2,
      operationalCode: null,
      certificate,
    });
  } catch (e) {
    if (e instanceof TruthLayerError) {
      writeOperationalErr(e.code, e.message);
      exitAfterEnforceCliReceipt({
        parsedBatch,
        quick: pq,
        exitCode: 3,
        operationalCode: e.code,
        certificate,
      });
    }
    throw e;
  }
}
