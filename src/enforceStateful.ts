import { randomUUID } from "node:crypto";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { parseBatchVerifyCliArgs, parseQuickCliArgs } from "./cliArgv.js";
import { verifyWorkflow } from "./pipeline.js";
import { runBatchVerifyToValidatedResult } from "./standardVerifyWorkflowCli.js";
import { TruthLayerError } from "./truthLayerError.js";
import { stableStringify } from "./jsonStableStringify.js";
import { runLicensePreflightIfNeeded } from "./commercial/licensePreflight.js";
import { cliErrorEnvelope } from "./failureCatalog.js";
import { postEnforcementJson } from "./sdk/transport.js";
import { buildOutcomeCertificateFromQuickReport, buildOutcomeCertificateFromWorkflowResult } from "./outcomeCertificate.js";
import { runQuickVerifyToValidatedReport } from "./quickVerify/runQuickVerify.js";
import { canonicalCertificateSha256, materialTruthSha256 } from "./governanceEvidence.js";

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
    process.env.AGENTSKEPTIC_API_KEY?.trim() ||
    process.env.WORKFLOW_VERIFIER_API_KEY?.trim();
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

export async function runStatefulEnforce(args: string[]): Promise<void> {
  const mode = parseEnforceMode(args);
  const stripped = stripEnforceModeArgs(args);
  const isQuick = stripped.includes("--input") || stripped.includes("--export-registry") || stripped.includes("--emit-events");

  const runId =
    process.env.AGENTSKEPTIC_RUN_ID?.trim() ||
    process.env.WORKFLOW_VERIFIER_RUN_ID?.trim() ||
    randomUUID();
  await runLicensePreflightIfNeeded("enforce", { runId, xRequestId: randomUUID() });

  let terminalStatus: "complete" | "inconsistent" | "incomplete";
  let workflowId: string;
  let certificate: ReturnType<typeof buildOutcomeCertificateFromWorkflowResult> | ReturnType<typeof buildOutcomeCertificateFromQuickReport>;
  if (isQuick) {
    const pq = parseQuickCliArgs(stripped);
    const out = await runQuickVerifyToValidatedReport({
      inputUtf8: pq.inputPath === "-" ? await new Promise<string>((resolve, reject) => {
        let s = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (d) => {
          s += d;
        });
        process.stdin.on("end", () => resolve(s));
        process.stdin.on("error", reject);
      }) : await import("node:fs/promises").then((m) => m.readFile(pq.inputPath, "utf8")),
      postgresUrl: pq.postgresUrl ?? undefined,
      sqlitePath: pq.dbPath ?? undefined,
    });
    workflowId = pq.workflowIdQuick;
    certificate = buildOutcomeCertificateFromQuickReport({
      report: out.report,
      workflowId: pq.workflowIdQuick,
      humanReportOptions: {
        workflowId: pq.workflowIdQuick,
        eventsPath: pq.emitEventsPath ?? undefined,
        registryPath: pq.exportPath,
        dbFlag: pq.dbPath ?? undefined,
        postgresUrl: pq.postgresUrl !== undefined,
      },
    });
    terminalStatus =
      out.report.verdict === "pass" ? "complete"
      : out.report.verdict === "fail" ? "inconsistent"
      : "incomplete";
  } else {
    const parsed = parseBatchVerifyCliArgs(stripped);
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
  const payload = {
    schema_version: 2,
    run_id: runId,
    workflow_id: workflowId,
    outcome_certificate_v1: certificate,
    material_truth_sha256: materialTruthSha256(certificate),
    certificate_sha256: canonicalCertificateSha256(certificate),
  };

  const route =
    mode === "create-baseline" ? "/api/v1/enforcement/baselines"
    : mode === "accept-drift" ? "/api/v1/enforcement/accept"
    : "/api/v1/enforcement/check";

  const stateRes = await postEnforcementState(route, payload);
  if (!stateRes.ok) {
    const detail =
      typeof stateRes.body === "object" && stateRes.body !== null && "detail" in stateRes.body
        ? String((stateRes.body as { detail?: unknown }).detail ?? `HTTP ${stateRes.status}`)
        : `HTTP ${stateRes.status}`;
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.LICENSE_DENIED,
      `${detail}${stateRes.requestId ? ` [x-request-id=${stateRes.requestId}]` : ""}`,
    );
  }

  const status =
    typeof stateRes.body === "object" && stateRes.body !== null && "status" in stateRes.body
      ? String((stateRes.body as { status?: unknown }).status ?? "ok")
      : "ok";
  process.stdout.write(`${stableStringify({ schemaVersion: 1, enforce: stateRes.body })}\n`);
  if (status === "drift") {
    console.error(cliErrorEnvelope(CLI_OPERATIONAL_CODES.VERIFICATION_OUTPUT_LOCK_MISMATCH, "Drift detected."));
    process.exit(4);
  }
  if (terminalStatus === "complete") process.exit(0);
  if (terminalStatus === "inconsistent") process.exit(1);
  process.exit(2);
}

