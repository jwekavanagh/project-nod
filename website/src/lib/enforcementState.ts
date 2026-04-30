import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { enforcementBaselines, enforcementEvents, governanceEvidence } from "@/db/schema";

type OutcomeCertificate = {
  schemaVersion: 1;
  workflowId: string;
  runKind: "contract_sql" | "contract_sql_langgraph_checkpoint_trust" | "quick_preview";
  stateRelation: "matches_expectations" | "does_not_match" | "not_established";
  explanation: { details: Array<{ code: string; message: string }> };
  steps: Array<{
    seq: number;
    toolId?: string;
    declaredAction: string;
    expectedOutcome: string;
    observedOutcome: string;
  }>;
  checkpointVerdicts?: Array<{ checkpointKey: string; verdict: "verified" | "inconsistent" | "incomplete"; seqs: number[] }>;
};

export type EnforcementEvidenceInput = {
  schema_version: 2;
  run_id: string;
  workflow_id: string;
  outcome_certificate_v1: OutcomeCertificate;
  material_truth_sha256: string;
  certificate_sha256: string;
};

/** POST /accept — governance envelope plus optimistic concurrency and pending-drift hash pin. */
export type EnforcementAcceptEvidenceInput = EnforcementEvidenceInput & {
  expected_projection_hash: string;
  lifecycle_state_version: number;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function materialTruthProjectionV1(c: OutcomeCertificate): Record<string, unknown> {
  const reasonCodes = [...new Set(c.explanation.details.map((d) => d.code))].sort((a, b) => a.localeCompare(b));
  const steps = [...c.steps]
    .map((s) => ({
      seq: s.seq,
      toolId: s.toolId ?? "",
      declaredAction: s.declaredAction,
      expectedOutcome: s.expectedOutcome,
      observedOutcome: s.observedOutcome,
    }))
    .sort((a, b) => a.seq - b.seq || a.toolId.localeCompare(b.toolId));
  const checkpointVerdicts = [...(c.checkpointVerdicts ?? [])]
    .map((v) => ({
      checkpointKey: v.checkpointKey,
      verdict: v.verdict,
      seqs: [...new Set(v.seqs)].sort((a, b) => a - b),
    }))
    .sort((a, b) => a.checkpointKey.localeCompare(b.checkpointKey));
  return {
    schemaVersion: 1,
    workflowId: c.workflowId,
    runKind: c.runKind,
    stateRelation: c.stateRelation,
    reasonCodes,
    steps,
    checkpointVerdicts,
  };
}

export function parseGovernanceEvidenceInput(body: unknown): EnforcementEvidenceInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const schema_version = b.schema_version;
  const run_id = typeof b.run_id === "string" ? b.run_id.trim() : "";
  const workflow_id = typeof b.workflow_id === "string" ? b.workflow_id.trim() : "";
  const material_truth_sha256 = typeof b.material_truth_sha256 === "string" ? b.material_truth_sha256.trim() : "";
  const certificate_sha256 = typeof b.certificate_sha256 === "string" ? b.certificate_sha256.trim() : "";
  const oc = b.outcome_certificate_v1;
  if (
    schema_version !== 2 ||
    !run_id ||
    !workflow_id ||
    !material_truth_sha256 ||
    !certificate_sha256 ||
    !oc ||
    typeof oc !== "object"
  ) {
    return null;
  }
  const cert = oc as OutcomeCertificate;
  if (
    cert.schemaVersion !== 1 ||
    typeof cert.workflowId !== "string" ||
    typeof cert.runKind !== "string" ||
    typeof cert.stateRelation !== "string" ||
    !Array.isArray(cert.steps) ||
    !cert.explanation ||
    !Array.isArray(cert.explanation.details)
  ) {
    return null;
  }
  return { schema_version: 2, run_id, workflow_id, outcome_certificate_v1: cert, material_truth_sha256, certificate_sha256 };
}

export function parseAcceptEvidenceInput(body: unknown): EnforcementAcceptEvidenceInput | null {
  const base = parseGovernanceEvidenceInput(body);
  if (!base) return null;
  const b = body as Record<string, unknown>;
  const expected = typeof b.expected_projection_hash === "string" ? b.expected_projection_hash.trim() : "";
  const verRaw = b.lifecycle_state_version;
  const lifecycle_state_version =
    typeof verRaw === "number" && Number.isFinite(verRaw) && Number.isInteger(verRaw)
      ? verRaw
      : typeof verRaw === "string" && /^\d+$/.test(verRaw.trim())
        ? Number.parseInt(verRaw.trim(), 10)
        : NaN;
  if (!expected || !Number.isInteger(lifecycle_state_version)) return null;
  return { ...base, expected_projection_hash: expected, lifecycle_state_version };
}

export function verifyEvidenceHashes(input: EnforcementEvidenceInput): {
  certificateSha256: string;
  materialTruthSha256: string;
  materialTruth: Record<string, unknown>;
} | null {
  const certificateSha256 = sha256Hex(stableStringify(input.outcome_certificate_v1));
  const materialTruth = materialTruthProjectionV1(input.outcome_certificate_v1);
  const materialTruthSha256 = sha256Hex(stableStringify(materialTruth));
  if (
    certificateSha256 !== input.certificate_sha256 ||
    materialTruthSha256 !== input.material_truth_sha256
  ) {
    return null;
  }
  return { certificateSha256, materialTruthSha256, materialTruth };
}

export async function createGovernanceEvidence(input: {
  userId: string;
  workflowId: string;
  runId: string;
  certificate: OutcomeCertificate;
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

