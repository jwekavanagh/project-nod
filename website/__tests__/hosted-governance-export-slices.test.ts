import type { OutcomeCertificateV1 } from "agentskeptic";
import { canonicalCertificateSha256, materialTruthProjectionFromCertificate, materialTruthSha256 } from "agentskeptic/governanceEvidence";
import hostedFixture from "./fixtures/hosted-governance-evidence-v3.min.json";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildEvidenceSlicesMap, type GovernanceEvidenceSliceRow } from "@/lib/governanceEvidenceSlices";

function rowFromEnvelope(
  id: string,
  userId: string,
  workflowId: string,
  runId: string,
  cert: OutcomeCertificateV1,
): GovernanceEvidenceSliceRow {
  const materialTruth = materialTruthProjectionFromCertificate(cert) as unknown as Record<string, unknown>;
  return {
    id,
    userId,
    workflowId,
    runId,
    certificateJson: cert as unknown as Record<string, unknown>,
    certificateSha256: canonicalCertificateSha256(cert),
    materialTruthJson: materialTruth,
    materialTruthSha256: materialTruthSha256(cert),
    createdAt: new Date(),
  };
}

describe("hosted governance export slices (SSOT map)", () => {
  const userId = "user-slice-tests";
  const wf = "wf_slice_tests";

  it("T5-export-two-distinct-evidenceSlices", () => {
    const runA = "run-a";
    const runB = "run-b";
    const idA = randomUUID();
    const idB = randomUUID();
    const cA = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cA.workflowId = wf;
    cA.steps[0]!.observedOutcome = "a";
    const cB = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cB.workflowId = wf;
    cB.steps[0]!.observedOutcome = "b";
    const built = buildEvidenceSlicesMap([
      rowFromEnvelope(idA, userId, wf, runA, cA),
      rowFromEnvelope(idB, userId, wf, runB, cB),
    ]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.evidenceSlices)).toHaveLength(2);
    expect(built.evidenceSlices[idA]).toBeDefined();
    expect(built.evidenceSlices[idB]).toBeDefined();
  });

  it("T6-no-latest-cert-head-substitution", () => {
    const idO = randomUUID();
    const idN = randomUUID();
    const envO = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    envO.workflowId = wf;
    envO.steps[0]!.observedOutcome = "o-head";
    const envN = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    envN.workflowId = wf;
    envN.steps[0]!.observedOutcome = "n-head";

    const rowO = rowFromEnvelope(idO, userId, wf, "run-o", envO);
    const rowN = rowFromEnvelope(idN, userId, wf, "run-n", envN);

    const built = buildEvidenceSlicesMap([rowO, rowN]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    expect(built.evidenceSlices[idO]!.fingerprints.certificateSha256).toBe(rowO.certificateSha256);
    expect(built.evidenceSlices[idN]!.fingerprints.certificateSha256).toBe(rowN.certificateSha256);
    expect(built.evidenceSlices[idO]!.fingerprints.certificateSha256).not.toBe(built.evidenceSlices[idN]!.fingerprints.certificateSha256);

    const evt = { evidenceSliceKey: idO, evidence: rowO as unknown as GovernanceEvidenceSliceRow };
    expect(evt.evidenceSliceKey).toBe(idO);
    expect(JSON.stringify(evt.evidence)).not.toContain(rowN.certificateSha256);

    const assembledExport = { schemaVersion: 3 as const, evidenceSlices: built.evidenceSlices };
    expect("decisionEvidenceExport" in assembledExport).toBe(false);
  });

  it("T7-export-forbids-hosted-not-recorded-string", () => {
    const cert = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cert.workflowId = wf;
    const id = randomUUID();
    const built = buildEvidenceSlicesMap([rowFromEnvelope(id, userId, wf, "r7", cert)]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;

    const payload = {
      schemaVersion: 3 as const,
      evidenceSlices: built.evidenceSlices,
      baselineAcceptedEvidence: null,
    };
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("hosted_not_recorded");
    expect(Object.hasOwn(payload, "decisionEvidenceExport")).toBe(false);
  });

  it("T8-corrupted-evidence-row-500", () => {
    const cert = structuredClone(hostedFixture.outcome_certificate) as OutcomeCertificateV1;
    cert.workflowId = wf;
    const id = randomUUID();
    let row = rowFromEnvelope(id, userId, wf, "r8", cert);
    row = { ...row, certificateSha256: "f".repeat(64) };

    const built = buildEvidenceSlicesMap([row]);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.evidenceId).toBe(id);
    expect(JSON.stringify({ code: "CORRUPTED_EVIDENCE_ROW", evidence_id: built.evidenceId })).not.toContain("hosted_not_recorded");
  });
});
