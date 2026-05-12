import { and, desc, eq } from "drizzle-orm";
import type { OutcomeCertificateV1 } from "agentskeptic";
import {
  canonicalCertificateSha256,
  materialTruthProjectionFromCertificate,
  materialTruthSha256,
} from "agentskeptic/governanceEvidence";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
import { db } from "@/db/client";
import { enforcementBaselines, enforcementEvents, governanceAcceptance, governanceEvidence } from "@/db/schema";

export type EnforcementEvidenceInput = {
  schema_version: 3;
  run_id: string;
  workflow_id: string;
  outcome_certificate: OutcomeCertificateV1;
  material_truth_sha256: string;
  certificate_sha256: string;
};

/** POST /accept — governance envelope plus optimistic concurrency and pending-drift hash pin. */
export type EnforcementAcceptEvidenceInput = EnforcementEvidenceInput & {
  expected_projection_hash: string;
  lifecycle_state_version: number;
  acceptance_reason: string;
  acceptance_owner: string;
  evidence_links?: string[];
  exception_review_by?: Date;
};

export type ParseGovernanceEvidenceResult =
  | { ok: true; input: EnforcementEvidenceInput }
  | { ok: false; message: string };

export type ParseAcceptEvidenceResult =
  | { ok: true; input: EnforcementAcceptEvidenceInput }
  | { ok: false; message: string };

export function parseGovernanceEvidenceInput(body: unknown): ParseGovernanceEvidenceResult {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Missing governance evidence fields." };
  }
  const b = body as Record<string, unknown>;
  const schema_version = b.schema_version;
  const run_id = typeof b.run_id === "string" ? b.run_id.trim() : "";
  const workflow_id = typeof b.workflow_id === "string" ? b.workflow_id.trim() : "";
  const material_truth_sha256 = typeof b.material_truth_sha256 === "string" ? b.material_truth_sha256.trim() : "";
  const certificate_sha256 = typeof b.certificate_sha256 === "string" ? b.certificate_sha256.trim() : "";
  const oc = b.outcome_certificate;
  if (
    schema_version !== 3 ||
    !run_id ||
    !workflow_id ||
    !material_truth_sha256 ||
    !certificate_sha256 ||
    !oc ||
    typeof oc !== "object"
  ) {
    return { ok: false, message: "Missing governance evidence fields." };
  }
  const certRecord = oc as Record<string, unknown>;
  // Hosted ingest rejects inner v2 before AJV. Audit grep: cert.schemaVersion !== 2
  if (certRecord.schemaVersion === 2) {
    return {
      ok: false,
      message:
        "Unsupported outcome certificate: outcome_certificate_v2_unsupported. Inner Outcome Certificate must be schemaVersion 3.",
    };
  }

  const validate = loadSchemaValidator("outcome-certificate-v3");
  if (!validate(oc)) {
    return {
      ok: false,
      message: `outcome_certificate invalid: ${JSON.stringify(validate.errors ?? [])}`,
    };
  }
  const certificate = oc as OutcomeCertificateV1;

  if (certificate.workflowId.trim() !== workflow_id) {
    return { ok: false, message: "outcome_certificate.workflowId must match workflow_id." };
  }

  return {
    ok: true,
    input: {
      schema_version: 3,
      run_id,
      workflow_id,
      outcome_certificate: certificate,
      material_truth_sha256,
      certificate_sha256,
    },
  };
}

const MAX_GOVERNED_EVIDENCE_LINKS = 8;
const MAX_GOVERNED_EVIDENCE_URL_LEN = 2048;

function parseEvidenceLinks(raw: unknown): { ok: true; links: string[] } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: true, links: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, message: "evidence_links must be an array of HTTPS URLs." };
  }
  if (raw.length > MAX_GOVERNED_EVIDENCE_LINKS) {
    return { ok: false, message: `evidence_links must have at most ${String(MAX_GOVERNED_EVIDENCE_LINKS)} entries.` };
  }
  const links: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, message: "evidence_links must be an array of HTTPS URLs." };
    }
    const u = item.trim();
    if (!u) {
      return { ok: false, message: "evidence_links entries must be non-empty HTTPS URL strings." };
    }
    if (u.length > MAX_GOVERNED_EVIDENCE_URL_LEN) {
      return { ok: false, message: `evidence_links URL exceeds ${String(MAX_GOVERNED_EVIDENCE_URL_LEN)} characters.` };
    }
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "https:") {
        return { ok: false, message: "evidence_links URLs must use https scheme." };
      }
    } catch {
      return { ok: false, message: "evidence_links must be an array of HTTPS URLs." };
    }
    links.push(u);
  }
  return { ok: true, links };
}

function parseExceptionReviewBy(
  raw: unknown,
  nowMs: number,
): { ok: true; date?: Date } | { ok: false; message: string } {
  if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) {
    return { ok: true, date: undefined };
  }
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) {
    return { ok: false, message: "exception_review_by must be a valid ISO-8601 timestamp." };
  }
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) {
    return { ok: false, message: "exception_review_by must be a valid ISO-8601 timestamp." };
  }
  if (d.getTime() <= nowMs) {
    return { ok: false, message: "exception_review_by must be strictly in the future." };
  }
  return { ok: true, date: d };
}

export function parseAcceptEvidenceInput(
  body: unknown,
  options?: { now?: Date },
): ParseAcceptEvidenceResult {
  const base = parseGovernanceEvidenceInput(body);
  if (!base.ok) return base;
  const b = body as Record<string, unknown>;
  const expected = typeof b.expected_projection_hash === "string" ? b.expected_projection_hash.trim() : "";
  const verRaw = b.lifecycle_state_version;
  const lifecycle_state_version =
    typeof verRaw === "number" && Number.isFinite(verRaw) && Number.isInteger(verRaw)
      ? verRaw
      : typeof verRaw === "string" && /^\d+$/.test(verRaw.trim())
        ? Number.parseInt(verRaw.trim(), 10)
        : NaN;
  if (!expected || !Number.isInteger(lifecycle_state_version)) {
    return {
      ok: false,
      message:
        "Missing governance evidence fields or accept requirements: expected_projection_hash and lifecycle_state_version.",
    };
  }

  const acceptance_reason =
    typeof b.acceptance_reason === "string" ? b.acceptance_reason.trim() : "";
  const acceptance_owner =
    typeof b.acceptance_owner === "string" ? b.acceptance_owner.trim() : "";
  if (!acceptance_reason) {
    return { ok: false, message: "Missing acceptance_reason." };
  }
  if (!acceptance_owner) {
    return { ok: false, message: "Missing acceptance_owner." };
  }

  const linksParsed = parseEvidenceLinks(b.evidence_links);
  if (!linksParsed.ok) return linksParsed;

  const nowMs = (options?.now ?? new Date()).getTime();
  const reviewParsed = parseExceptionReviewBy(b.exception_review_by, nowMs);
  if (!reviewParsed.ok) return reviewParsed;

  return {
    ok: true,
    input: {
      ...base.input,
      expected_projection_hash: expected,
      lifecycle_state_version,
      acceptance_reason,
      acceptance_owner,
      ...(linksParsed.links.length > 0 ? { evidence_links: linksParsed.links } : {}),
      ...(reviewParsed.date !== undefined ? { exception_review_by: reviewParsed.date } : {}),
    },
  };
}

export function verifyEvidenceHashes(input: EnforcementEvidenceInput): {
  certificateSha256: string;
  materialTruthSha256: string;
  materialTruth: Record<string, unknown>;
} | null {
  const cert = input.outcome_certificate;
  const certificateSha256 = canonicalCertificateSha256(cert);
  const materialTruthSha256Computed = materialTruthSha256(cert);
  const materialTruth = materialTruthProjectionFromCertificate(cert) as unknown as Record<string, unknown>;
  if (certificateSha256 !== input.certificate_sha256 || materialTruthSha256Computed !== input.material_truth_sha256) {
    return null;
  }
  return { certificateSha256, materialTruthSha256: materialTruthSha256Computed, materialTruth };
}

export async function createGovernanceEvidence(input: {
  userId: string;
  workflowId: string;
  runId: string;
  certificate: OutcomeCertificateV1;
  certificateSha256: string;
  materialTruth: Record<string, unknown>;
  materialTruthSha256: string;
}): Promise<string> {
  const out = await db
    .insert(governanceEvidence)
    .values({
      userId: input.userId,
      workflowId: input.workflowId,
      runId: input.runId,
      certificateJson: input.certificate as unknown as Record<string, unknown>,
      certificateSha256: input.certificateSha256,
      materialTruthJson: input.materialTruth,
      materialTruthSha256: input.materialTruthSha256,
    })
    .returning({ id: governanceEvidence.id });
  return out[0]!.id;
}

export async function upsertBaseline(input: {
  userId: string;
  keyId: string;
  workflowId: string;
  projectionHash: string;
  projection: unknown;
  baselineEvidenceId?: string;
  activeAcceptanceId?: string | null;
  needsRebaseline?: boolean;
}): Promise<void> {
  const existing = await db
    .select()
    .from(enforcementBaselines)
    .where(and(eq(enforcementBaselines.userId, input.userId), eq(enforcementBaselines.workflowId, input.workflowId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(enforcementBaselines).values({
      userId: input.userId,
      workflowId: input.workflowId,
      projectionHash: input.projectionHash,
      projection: input.projection as Record<string, unknown>,
      baselineEvidenceId: input.baselineEvidenceId ?? null,
      activeAcceptanceId: input.activeAcceptanceId ?? null,
      needsRebaseline: input.needsRebaseline ?? false,
      acceptedByKeyId: input.keyId,
    });
    return;
  }
  await db
    .update(enforcementBaselines)
    .set({
      projectionHash: input.projectionHash,
      projection: input.projection as Record<string, unknown>,
      baselineEvidenceId: input.baselineEvidenceId ?? null,
      ...(input.activeAcceptanceId !== undefined ? { activeAcceptanceId: input.activeAcceptanceId } : {}),
      needsRebaseline: input.needsRebaseline ?? false,
      acceptedByKeyId: input.keyId,
      updatedAt: new Date(),
    })
    .where(eq(enforcementBaselines.id, existing[0]!.id));
}

export async function getBaseline(input: {
  userId: string;
  workflowId: string;
}): Promise<(typeof enforcementBaselines.$inferSelect) | null> {
  const rows = await db
    .select()
    .from(enforcementBaselines)
    .where(and(eq(enforcementBaselines.userId, input.userId), eq(enforcementBaselines.workflowId, input.workflowId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Appends read-only-compatible timeline rows (`enforcement_events`).
 * Hosted lifecycle authority is enforced via `enforcement_lifecycle`,
 * `enforcement_transition`, and `enforcement_decision`; do not infer posture from events alone.
 */
export async function appendEnforcementEvent(input: {
  userId: string;
  workflowId: string;
  runId: string;
  event: "baseline_created" | "check_pass" | "drift_detected" | "drift_accepted";
  expectedProjectionHash: string | null;
  actualProjectionHash: string;
  evidenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(enforcementEvents).values({
    userId: input.userId,
    workflowId: input.workflowId,
    runId: input.runId,
    event: input.event,
    expectedProjectionHash: input.expectedProjectionHash,
    actualProjectionHash: input.actualProjectionHash,
    evidenceId: input.evidenceId ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function listGovernanceAcceptances(input: {
  userId: string;
  workflowId: string;
  limit?: number;
}): Promise<Array<typeof governanceAcceptance.$inferSelect>> {
  const n = Math.max(1, Math.min(200, input.limit ?? 50));
  return await db
    .select()
    .from(governanceAcceptance)
    .where(and(eq(governanceAcceptance.userId, input.userId), eq(governanceAcceptance.workflowId, input.workflowId)))
    .orderBy(desc(governanceAcceptance.createdAt))
    .limit(n);
}

export async function listEnforcementHistory(input: {
  userId: string;
  workflowId: string;
  limit?: number;
}): Promise<Array<typeof enforcementEvents.$inferSelect>> {
  const n = Math.max(1, Math.min(200, input.limit ?? 50));
  return await db
    .select()
    .from(enforcementEvents)
    .where(and(eq(enforcementEvents.userId, input.userId), eq(enforcementEvents.workflowId, input.workflowId)))
    .orderBy(desc(enforcementEvents.createdAt))
    .limit(n);
}
