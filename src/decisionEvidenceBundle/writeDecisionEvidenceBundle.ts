import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { atomicWriteUtf8File } from "../quickVerify/atomicWrite.js";
import type { OutcomeCertificateV1 } from "../outcomeCertificate.js";
import { loadSchemaValidator } from "../schemaLoad.js";
import { TruthLayerError } from "../truthLayerError.js";
import { CLI_OPERATIONAL_CODES, formatOperationalMessage } from "../failureCatalog.js";
import { buildHumanLayerFileJson } from "../decisionEvidenceHumanLayer.js";
import { DECISION_EVIDENCE_FILES } from "./constants.js";
import { exitCodeFromOutcomeCertificate } from "./exitCode.js";
import {
  a5RequiredFromCertificate,
  computeCompletenessFromParts,
  type DecisionEvidenceCompleteness,
} from "./completeness.js";

function readPackageIdentity(): { name: string; version: string } {
  const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { name?: string; version?: string };
  const name = typeof pkg.name === "string" && pkg.name.length > 0 ? pkg.name : "agentskeptic";
  const version = typeof pkg.version === "string" && pkg.version.length > 0 ? pkg.version : "0.0.0";
  return { name, version };
}

export type WriteDecisionEvidenceBundleOptions = {
  outDir: string;
  certificate: OutcomeCertificateV1;
  noHumanReport: boolean;
  runId?: string;
  producer?: { name: string; version: string };
  /** Validated against decision-evidence-attestation-v1 when present. */
  attestation?: unknown;
  /** Validated against decision-evidence-next-action-v1 when present. */
  nextAction?: unknown;
};

function validateOptional(schemaName: Parameters<typeof loadSchemaValidator>[0], label: string, value: unknown): void {
  const v = loadSchemaValidator(schemaName);
  if (!v(value)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.CLI_USAGE,
      formatOperationalMessage(`${label}: ${JSON.stringify(v.errors ?? [])}`),
    );
  }
}

/**
 * Writes Decision Evidence Bundle: outcome-certificate, exit, human-layer, optional attestation/next-action, manifest last.
 */
export function writeDecisionEvidenceBundle(options: WriteDecisionEvidenceBundleOptions): DecisionEvidenceCompleteness {
  const resolved = path.resolve(options.outDir);
  mkdirSync(resolved, { recursive: true });

  const validateCert = loadSchemaValidator("outcome-certificate-v2");
  if (!validateCert(options.certificate)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.INTERNAL_ERROR,
      formatOperationalMessage(`writeDecisionEvidenceBundle: certificate invalid ${JSON.stringify(validateCert.errors ?? [])}`),
    );
  }

  if (options.attestation !== undefined) {
    validateOptional("decision-evidence-attestation-v1", "decision attestation", options.attestation);
  }
  if (options.nextAction !== undefined) {
    validateOptional("decision-evidence-next-action-v1", "decision next-action", options.nextAction);
  }

  const outcomeUtf8 = `${JSON.stringify(options.certificate)}\n`;
  const exitPayload = {
    schemaVersion: 1 as const,
    exitCode: exitCodeFromOutcomeCertificate(options.certificate),
    cliConvention: "outcome_certificate_v2" as const,
  };
  validateOptional("decision-evidence-exit-v1", "exit", exitPayload);
  const exitUtf8 = `${JSON.stringify(exitPayload)}\n`;

  const humanLayer = buildHumanLayerFileJson(options.certificate, options.noHumanReport);
  validateOptional("decision-evidence-human-layer-v1", "human-layer", humanLayer);
  const humanUtf8 = `${JSON.stringify(humanLayer)}\n`;

  const producer = options.producer ?? readPackageIdentity();
  const a4Present = options.attestation !== undefined;
  const a5Present = options.nextAction !== undefined;

  atomicWriteUtf8File(path.join(resolved, DECISION_EVIDENCE_FILES.outcomeCertificate), outcomeUtf8);
  atomicWriteUtf8File(path.join(resolved, DECISION_EVIDENCE_FILES.exit), exitUtf8);
  atomicWriteUtf8File(path.join(resolved, DECISION_EVIDENCE_FILES.humanLayer), humanUtf8);

  if (options.attestation !== undefined) {
    atomicWriteUtf8File(
      path.join(resolved, DECISION_EVIDENCE_FILES.attestation),
      `${JSON.stringify(options.attestation)}\n`,
    );
  }
  if (options.nextAction !== undefined) {
    atomicWriteUtf8File(
      path.join(resolved, DECISION_EVIDENCE_FILES.nextAction),
      `${JSON.stringify(options.nextAction)}\n`,
    );
  }

  const computed = computeCompletenessFromParts({
    certificateValid: true,
    coreFilesPresent: true,
    certificate: options.certificate,
    a4Present,
    a5Present,
  });

  const manifestPayload = {
    schemaVersion: 1 as const,
    bundleKind: "decision_evidence" as const,
    producer,
    createdAt: new Date().toISOString(),
    workflowId: options.certificate.workflowId,
    ...(options.runId !== undefined ? { runId: options.runId } : {}),
    completeness: {
      status: computed.status,
      artifacts: computed.artifacts,
    },
  };

  validateOptional("decision-evidence-bundle-manifest-v1", "manifest", manifestPayload);
  atomicWriteUtf8File(path.join(resolved, DECISION_EVIDENCE_FILES.manifest), `${JSON.stringify(manifestPayload)}\n`);

  return computed;
}
