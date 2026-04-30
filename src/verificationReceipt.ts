/**
 * Mandatory verification receipts (verification-receipt-v1) written under cwd artifacts/.
 */
import { Ajv2020 } from "ajv/dist/2020.js";
import ajvFormats from "ajv-formats";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const applyAjvFormats = ajvFormats as unknown as (ajv: InstanceType<typeof Ajv2020>) => InstanceType<typeof Ajv2020>;

export type ReceiptKind = "merge_gate" | "verify" | "enforce";

export type VerificationReceiptInput = {
  packageRoot: string;
  cwd: string;
  kind: ReceiptKind;
  outcome: "success" | "failure" | "operational_abort";
  exitCode: number;
  verificationSummary: {
    workflowStatus: string | null;
    operationalCode: string | null;
    enforceExitKind: string | null;
  };
  inputIntegrity: {
    workflowId: string;
    dbKind: "sqlite" | "postgres" | "none";
    eventsSha256: string | null;
    registrySha256: string | null;
    npmTestScript: string | null;
    verificationTruthExitPhase: string | null;
  };
  phaseTimingsMs: {
    regeneration: number;
    preflightDriftRoster: number;
    gitDiffGate: number;
    structuralGuards: number;
    postgresDistribution: number;
    journeyTail: number;
  } | null;
};

let receiptValidator: ReturnType<Ajv2020["compile"]> | undefined;

function getReceiptValidator(schemasDir: string) {
  if (receiptValidator) return receiptValidator;
  const schemaPath = path.join(schemasDir, "verification-receipt-v1.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const ajv = applyAjvFormats(new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true }));
  receiptValidator = ajv.compile(schema);
  return receiptValidator;
}

function resolveSchemasDir(packageRoot: string): string {
  return path.join(packageRoot, "schemas");
}

function lfNormalizedSha256(absPath: string): string {
  const raw = readFileSync(absPath);
  const lower = absPath.replace(/\\/g, "/").toLowerCase();
  const isText =
    lower.endsWith(".json") || lower.endsWith(".ndjson") || lower.endsWith(".yaml") || lower.endsWith(".yml");
  const buf = isText ? Buffer.from(raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8") : raw;
  return createHash("sha256").update(buf).digest("hex");
}

function trySha256LfFile(absPath: string): string | null {
  try {
    return lfNormalizedSha256(absPath);
  } catch {
    return null;
  }
}

function loadExecutionIdentity(packageRoot: string): {
  embedded: Record<string, unknown> | null;
  sha256: string | null;
  abortReason: "MISSING_DIST_EXECUTION_IDENTITY" | null;
} {
  const p = path.join(packageRoot, "dist", "execution-identity.v1.json");
  try {
    const raw = readFileSync(p, "utf8");
    const lf = Buffer.from(raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n"), "utf8");
    const sha256 = createHash("sha256").update(lf).digest("hex");
    return {
      embedded: JSON.parse(raw) as Record<string, unknown>,
      sha256,
      abortReason: null,
    };
  } catch {
    return { embedded: null, sha256: null, abortReason: "MISSING_DIST_EXECUTION_IDENTITY" };
  }
}

/**
 * Persist receipt JSON. Returns error message when schema invalid or IO failed — caller exits 3 with stderr.
 */
export function writeVerificationReceipt(input: VerificationReceiptInput): { ok: true } | { ok: false; message: string } {
  const schemasDir = resolveSchemasDir(input.packageRoot);
  const validate = getReceiptValidator(schemasDir);
  const emittedAt = new Date().toISOString();
  const emittedAtCompact = emittedAt.replace(/:/g, "-");
  const fname = `agentskeptic.verification-receipt.v1.${emittedAtCompact}_${process.pid}.json`;
  const receiptDirAbs = path.join(input.cwd, "artifacts", "agentskeptic-receipts");
  const receiptPathRelativePosix = path.join("artifacts", "agentskeptic-receipts", fname).split(path.sep).join("/");

  const id = loadExecutionIdentity(input.packageRoot);
  let abortReason: "MISSING_DIST_EXECUTION_IDENTITY" | null = id.abortReason;
  if (id.embedded !== null) {
    abortReason = null;
  }

  const doc = {
    $schema: "https://agentskeptic.com/schemas/verification-receipt-v1.schema.json",
    abortReason,
    emittedAt,
    executionIdentityEmbedded: id.embedded,
    executionIdentitySha256: id.sha256,
    exitCode: input.exitCode,
    inputIntegrity: input.inputIntegrity,
    kind: input.kind,
    outcome: input.outcome,
    phaseTimingsMs: input.phaseTimingsMs,
    pid: process.pid,
    receiptPathRelative: receiptPathRelativePosix,
    receiptVersion: "1.0.0",
    runtime: {
      arch: process.arch,
      nodeProcessVersion: process.version,
      platform: process.platform,
    },
    verificationSummary: input.verificationSummary,
  };

  if (!validate(doc)) {
    const detail = validate.errors?.length ? JSON.stringify(validate.errors) : "validation failed";
    return { ok: false, message: `RECEIPT_SCHEMA_INVALID ${detail}` };
  }

  const json = `${JSON.stringify(doc, null, 2)}\n`;
  mkdirSync(receiptDirAbs, { recursive: true });
  const tmp = path.join(receiptDirAbs, `.tmp-${randomUUID()}.json`);
  const finalAbs = path.join(receiptDirAbs, fname);
  try {
    writeFileSync(tmp, json, "utf8");
    renameSync(tmp, finalAbs);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `RECEIPT_PERSIST_FAILED ${msg}` };
  }
  return { ok: true };
}

/** Package root: parent of `dist/` (same folder as `schemas/`) when resolved from a compiled file under `dist/`. */
export function npmPackageRootFromHere(importMetaUrl: string): string {
  const here = path.dirname(fileURLToPath(importMetaUrl));
  return path.resolve(here, "..");
}

export function workflowStatusFromOutcomeCertificateRelation(
  rel: string | undefined,
): "complete" | "inconsistent" | "incomplete" | null {
  if (rel === "matches_expectations") return "complete";
  if (rel === "does_not_match") return "inconsistent";
  if (rel === "insufficient_information") return "incomplete";
  return null;
}

export { trySha256LfFile };
