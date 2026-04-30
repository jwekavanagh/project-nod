/**
 * Sole exit boundary for verification receipts on batch verify, quick verify, and enforce CLI paths.
 */
import path from "node:path";
import type { ParsedBatchVerifyCli, ParsedQuickCli } from "./cliArgv.js";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { cliErrorEnvelope, formatOperationalMessage } from "./failureCatalog.js";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import {
  npmPackageRootFromHere,
  trySha256LfFile,
  workflowStatusFromOutcomeCertificateRelation,
  writeVerificationReceipt,
  type VerificationReceiptInput,
} from "./verificationReceipt.js";

const defaultPackageRoot = npmPackageRootFromHere(import.meta.url);

function cliOutcomeFromExit(exitCode: number): VerificationReceiptInput["outcome"] {
  if (exitCode === 3) return "operational_abort";
  if (exitCode === 0) return "success";
  return "failure";
}

export function verifyInputIntegrity(parsed: ParsedBatchVerifyCli | null): VerificationReceiptInput["inputIntegrity"] {
  if (parsed === null) {
    return {
      workflowId: "",
      dbKind: "none",
      eventsSha256: null,
      registrySha256: null,
      npmTestScript: null,
      verificationTruthExitPhase: null,
    };
  }
  const dbKind = parsed.database.kind === "postgres" ? "postgres" : "sqlite";
  return {
    workflowId: parsed.workflowId,
    dbKind,
    eventsSha256: trySha256LfFile(path.resolve(parsed.eventsPath)),
    registrySha256: trySha256LfFile(path.resolve(parsed.registryPath)),
    npmTestScript: null,
    verificationTruthExitPhase: null,
  };
}

export function quickInputIntegrity(quick: ParsedQuickCli): VerificationReceiptInput["inputIntegrity"] {
  const dbKind = quick.postgresUrl !== undefined ? "postgres" : "sqlite";
  const eventsAbs =
    quick.emitEventsPath !== undefined ? path.resolve(quick.emitEventsPath) : null;
  return {
    workflowId: quick.workflowIdQuick,
    dbKind,
    eventsSha256: eventsAbs !== null ? trySha256LfFile(eventsAbs) : null,
    registrySha256: trySha256LfFile(path.resolve(quick.exportPath)),
    npmTestScript: null,
    verificationTruthExitPhase: null,
  };
}

export function verifyVerificationSummary(args: {
  exitCode: number;
  operationalCode: string | null;
  certificate: OutcomeCertificateV1 | null;
  /** Batch integrator-owned gate-style exit without certificate */
  verdictIncompleteWithoutCertificate?: boolean;
}): VerificationReceiptInput["verificationSummary"] {
  if (args.exitCode === 3 && args.operationalCode !== null) {
    return { workflowStatus: null, operationalCode: args.operationalCode, enforceExitKind: null };
  }
  if (args.certificate !== null) {
    return {
      operationalCode: null,
      enforceExitKind: null,
      workflowStatus: workflowStatusFromOutcomeCertificateRelation(args.certificate.stateRelation),
    };
  }
  if (args.verdictIncompleteWithoutCertificate) {
    return { workflowStatus: "incomplete", operationalCode: null, enforceExitKind: null };
  }
  return { workflowStatus: null, operationalCode: null, enforceExitKind: null };
}

function receiptPersistEnvelope(message: string): string {
  if (message.startsWith("RECEIPT_SCHEMA_INVALID")) {
    return cliErrorEnvelope(CLI_OPERATIONAL_CODES.RECEIPT_SCHEMA_INVALID, formatOperationalMessage(message));
  }
  return cliErrorEnvelope(CLI_OPERATIONAL_CODES.RECEIPT_PERSIST_FAILED, formatOperationalMessage(message));
}

/** After stdout certificate line (when applicable). */
export function exitAfterVerifyCliReceipt(args: {
  cwd?: string;
  packageRoot?: string;
  parsedBatch: ParsedBatchVerifyCli | null;
  exitCode: number;
  certificate: OutcomeCertificateV1 | null;
  operationalCode: string | null;
  verdictIncompleteWithoutCertificate?: boolean;
}): never {
  const cwd = args.cwd ?? process.cwd();
  const r = writeVerificationReceipt({
    cwd,
    exitCode: args.exitCode,
    outcome: cliOutcomeFromExit(args.exitCode),
    inputIntegrity: verifyInputIntegrity(args.parsedBatch),
    kind: "verify",
    packageRoot: args.packageRoot ?? defaultPackageRoot,
    phaseTimingsMs: null,
    verificationSummary: verifyVerificationSummary({
      certificate: args.certificate,
      exitCode: args.exitCode,
      operationalCode: args.operationalCode,
      verdictIncompleteWithoutCertificate: args.verdictIncompleteWithoutCertificate,
    }),
  });
  if (!r.ok) {
    console.error(receiptPersistEnvelope(r.message));
    process.exit(3);
  }
  process.exit(args.exitCode);
}

export function exitAfterQuickVerifyReceipt(args: {
  cwd?: string;
  packageRoot?: string;
  quick: ParsedQuickCli;
  exitCode: number;
  certificate: OutcomeCertificateV1 | null;
  operationalCode: string | null;
}): never {
  const cwd = args.cwd ?? process.cwd();
  const r = writeVerificationReceipt({
    cwd,
    exitCode: args.exitCode,
    outcome: cliOutcomeFromExit(args.exitCode),
    inputIntegrity: quickInputIntegrity(args.quick),
    kind: "verify",
    packageRoot: args.packageRoot ?? defaultPackageRoot,
    phaseTimingsMs: null,
    verificationSummary: verifyVerificationSummary({
      certificate: args.certificate,
      exitCode: args.exitCode,
      operationalCode: args.operationalCode,
    }),
  });
  if (!r.ok) {
    console.error(receiptPersistEnvelope(r.message));
    process.exit(3);
  }
  process.exit(args.exitCode);
}

/** Enforce: exit codes 4 = drift (failure outcome). */
export function exitAfterEnforceCliReceipt(args: {
  cwd?: string;
  packageRoot?: string;
  parsedBatch: ParsedBatchVerifyCli | null;
  quick: ParsedQuickCli | null;
  exitCode: number;
  operationalCode: string | null;
  certificate: OutcomeCertificateV1 | null;
  /** When API reports drift status (CLI exit 4). */
  enforceExitKindDrift?: boolean;
}): never {
  const cwd = args.cwd ?? process.cwd();
  const inputIntegrity =
    args.quick !== null
      ? quickInputIntegrity(args.quick)
      : args.parsedBatch !== null
        ? verifyInputIntegrity(args.parsedBatch)
        : verifyInputIntegrity(null);
  const wfStatus =
    args.certificate !== null
      ? workflowStatusFromOutcomeCertificateRelation(args.certificate.stateRelation)
      : null;
  const summary: VerificationReceiptInput["verificationSummary"] = {
    enforceExitKind: args.enforceExitKindDrift ? "drift" : null,
    operationalCode:
      args.exitCode === 3 && args.operationalCode !== null ? args.operationalCode : null,
    workflowStatus: wfStatus,
  };
  const r = writeVerificationReceipt({
    cwd,
    exitCode: args.exitCode,
    outcome: cliOutcomeFromExit(args.exitCode),
    inputIntegrity,
    kind: "enforce",
    packageRoot: args.packageRoot ?? defaultPackageRoot,
    phaseTimingsMs: null,
    verificationSummary: summary,
  });
  if (!r.ok) {
    console.error(receiptPersistEnvelope(r.message));
    process.exit(3);
  }
  process.exit(args.exitCode);
}
