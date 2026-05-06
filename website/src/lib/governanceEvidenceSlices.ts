import type { OutcomeCertificateV1, OutcomeCertificateV3 } from "agentskeptic";
import { truthCheckVerdictFromCertificate } from "agentskeptic";
import { computeCompletenessFromParts, exitCodeFromOutcomeCertificate } from "agentskeptic/decisionEvidenceBundle";
import { canonicalCertificateSha256, materialTruthSha256 } from "agentskeptic/governanceEvidence";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import type { governanceEvidence } from "@/db/schema";

/** JSON shape persisted in governance_evidence. */
export type GovernanceEvidenceSliceRow = typeof governanceEvidence.$inferSelect;

export type HostedEvidenceSliceV1Wire = {
  runId: string;
  outcomeCertificate: Record<string, unknown>;
  fingerprints: { certificateSha256: string; materialTruthSha256: string };
  hostedExit: { schemaVersion: 1; exitCode: number; cliConvention: "outcome_certificate_v2" };
  decisionCompleteness: {
    status: "complete" | "partial" | "invalid";
    artifacts: { a4Present: boolean; a5Present: boolean; a5Required: boolean };
  };
  truthCheckVerdict: string;
};

const validateOutcomeV3 = loadSchemaValidator("outcome-certificate-v3");

/**
 * Validates stored row (schema + fingerprints) and derives hosted exit / completeness — single path for `/governance/export` and tests.
 */
export function hostedEvidenceSliceFromRow(row: GovernanceEvidenceSliceRow): { ok: true; slice: HostedEvidenceSliceV1Wire } | { ok: false; evidenceId: string } {
  const raw = row.certificateJson;
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { ok: false, evidenceId: row.id };
  }
  if (!validateOutcomeV3(raw)) {
    return { ok: false, evidenceId: row.id };
  }
  const certificate = raw as unknown as OutcomeCertificateV1;
  if (
    canonicalCertificateSha256(certificate) !== row.certificateSha256 ||
    materialTruthSha256(certificate) !== row.materialTruthSha256
  ) {
    return { ok: false, evidenceId: row.id };
  }
  const hostedExit = {
    schemaVersion: 1 as const,
    exitCode: exitCodeFromOutcomeCertificate(certificate),
    cliConvention: "outcome_certificate_v2" as const,
  };
  const comp = computeCompletenessFromParts({
    certificateValid: true,
    coreFilesPresent: true,
    certificate,
    a4Present: false,
    a5Present: false,
  });

  const slice: HostedEvidenceSliceV1Wire = {
    runId: row.runId,
    outcomeCertificate: raw as Record<string, unknown>,
    fingerprints: {
      certificateSha256: row.certificateSha256,
      materialTruthSha256: row.materialTruthSha256,
    },
    hostedExit,
    decisionCompleteness: {
      status: comp.status,
      artifacts: comp.artifacts,
    },
    truthCheckVerdict: truthCheckVerdictFromCertificate(certificate as OutcomeCertificateV3),
  };
  return { ok: true, slice };
}

export function buildEvidenceSlicesMap(
  rows: GovernanceEvidenceSliceRow[],
): { ok: true; evidenceSlices: Record<string, HostedEvidenceSliceV1Wire> } | { ok: false; evidenceId: string } {
  const evidenceSlices: Record<string, HostedEvidenceSliceV1Wire> = {};
  for (const row of rows) {
    const built = hostedEvidenceSliceFromRow(row);
    if (!built.ok) {
      return { ok: false, evidenceId: built.evidenceId };
    }
    evidenceSlices[row.id] = built.slice;
  }
  return { ok: true, evidenceSlices };
}
