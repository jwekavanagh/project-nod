import { createHash } from "node:crypto";
import type { OutcomeCertificateV1 } from "./outcomeCertificate.js";
import { stableStringify } from "./jsonStableStringify.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import { TruthLayerError } from "./truthLayerError.js";
import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";

type MaterialTruthStep = {
  seq: number;
  toolId: string;
  declaredAction: string;
  expectedOutcome: string;
  observedOutcome: string;
};

type MaterialTruthCheckpointVerdict = {
  checkpointKey: string;
  verdict: "verified" | "inconsistent" | "incomplete";
  seqs: number[];
};

export type MaterialTruthV1 = {
  schemaVersion: 1;
  workflowId: string;
  runKind: OutcomeCertificateV1["runKind"];
  stateRelation: OutcomeCertificateV1["stateRelation"];
  reasonCodes: string[];
  steps: MaterialTruthStep[];
  checkpointVerdicts: MaterialTruthCheckpointVerdict[];
};

function sortedUniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildMaterialTruthProjectionV1(certificate: OutcomeCertificateV1): MaterialTruthV1 {
  const reasonCodes = sortedUniqueStrings(certificate.explanation.details.map((d) => d.code));
  const steps = [...certificate.steps]
    .map((s) => ({
      seq: s.seq,
      toolId: s.toolId ?? "",
      declaredAction: s.declaredAction,
      expectedOutcome: s.expectedOutcome,
      observedOutcome: s.observedOutcome,
    }))
    .sort((a, b) => a.seq - b.seq || a.toolId.localeCompare(b.toolId));
  const checkpointVerdicts = [...(certificate.checkpointVerdicts ?? [])]
    .map((v) => ({
      checkpointKey: v.checkpointKey,
      verdict: v.verdict,
      seqs: [...new Set(v.seqs)].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.checkpointKey.localeCompare(b.checkpointKey));
  const out: MaterialTruthV1 = {
    schemaVersion: 1,
    workflowId: certificate.workflowId,
    runKind: certificate.runKind,
    stateRelation: certificate.stateRelation,
    reasonCodes,
    steps,
    checkpointVerdicts,
  };
  const validate = loadSchemaValidator("material-truth-v1");
  if (!validate(out)) {
    throw new TruthLayerError(
      CLI_OPERATIONAL_CODES.WORKFLOW_RESULT_SCHEMA_INVALID,
      `material_truth_invalid: ${JSON.stringify(validate.errors ?? [])}`,
    );
  }
  return out;
}

function sha256HexUtf8(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function canonicalCertificateSha256(certificate: OutcomeCertificateV1): string {
  return sha256HexUtf8(stableStringify(certificate));
}

export function materialTruthProjectionV1(certificate: OutcomeCertificateV1): MaterialTruthV1 {
  return buildMaterialTruthProjectionV1(certificate);
}

export function materialTruthSha256(certificate: OutcomeCertificateV1): string {
  return sha256HexUtf8(stableStringify(buildMaterialTruthProjectionV1(certificate)));
}
