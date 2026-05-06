import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  enforcementBaselines,
  enforcementDecision,
  enforcementEvents,
  enforcementFsmTransition,
  enforcementLifecycle,
  governanceEvidence,
} from "@/db/schema";
import { buildEvidenceSlicesMap } from "@/lib/governanceEvidenceSlices";

const CORRUPTED_EVIDENCE_BODY = {
  code: "CORRUPTED_EVIDENCE_ROW",
  message:
    "Stored evidence row failed certificate schema validation or fingerprints do not match stored columns.",
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Authentication required." }, { status: 401 });
  }

  const workflowId = req.nextUrl.searchParams.get("workflow_id")?.trim() ?? "";
  if (!workflowId) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Missing workflow_id query parameter." }, { status: 400 });
  }
  const fromRaw = req.nextUrl.searchParams.get("from");
  const toRaw = req.nextUrl.searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : new Date(0);
  const to = toRaw ? new Date(toRaw) : new Date();
  if (!Number.isFinite(from.valueOf()) || !Number.isFinite(to.valueOf()) || from > to) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Invalid from/to range." }, { status: 400 });
  }

  function corruptedResponse(evidence_id: string) {
    return NextResponse.json({ ...CORRUPTED_EVIDENCE_BODY, evidence_id }, { status: 500 });
  }

  const lifecycleRows = await db
    .select()
    .from(enforcementLifecycle)
    .where(and(eq(enforcementLifecycle.userId, session.user.id), eq(enforcementLifecycle.workflowId, workflowId)))
    .limit(1);

  const fsmTransitions = await db
    .select()
    .from(enforcementFsmTransition)
    .where(
      and(eq(enforcementFsmTransition.userId, session.user.id), eq(enforcementFsmTransition.workflowId, workflowId)),
    )
    .orderBy(asc(enforcementFsmTransition.createdAt), asc(enforcementFsmTransition.id));

  const verificationDecisions = await db
    .select()
    .from(enforcementDecision)
    .where(and(eq(enforcementDecision.userId, session.user.id), eq(enforcementDecision.workflowId, workflowId)))
    .orderBy(asc(enforcementDecision.createdAt), asc(enforcementDecision.attemptId));

  const baselineRows = await db
    .select({
      id: enforcementBaselines.id,
      projectionHash: enforcementBaselines.projectionHash,
      baselineEvidenceId: enforcementBaselines.baselineEvidenceId,
      needsRebaseline: enforcementBaselines.needsRebaseline,
      createdAt: enforcementBaselines.createdAt,
      updatedAt: enforcementBaselines.updatedAt,
    })
    .from(enforcementBaselines)
    .where(and(eq(enforcementBaselines.userId, session.user.id), eq(enforcementBaselines.workflowId, workflowId)))
    .limit(1);

  const eventRows = await db
    .select({
      id: enforcementEvents.id,
      runId: enforcementEvents.runId,
      event: enforcementEvents.event,
      expectedProjectionHash: enforcementEvents.expectedProjectionHash,
      actualProjectionHash: enforcementEvents.actualProjectionHash,
      evidenceId: enforcementEvents.evidenceId,
      metadata: enforcementEvents.metadata,
      createdAt: enforcementEvents.createdAt,
    })
    .from(enforcementEvents)
    .where(
      and(
        eq(enforcementEvents.userId, session.user.id),
        eq(enforcementEvents.workflowId, workflowId),
        gte(enforcementEvents.createdAt, from),
        lte(enforcementEvents.createdAt, to),
      ),
    );

  const baselineRow = baselineRows[0] ?? null;
  const evidenceIdSet = new Set<string>();
  for (const e of eventRows) {
    if (e.evidenceId) evidenceIdSet.add(e.evidenceId);
  }
  for (const t of fsmTransitions) {
    if (t.evidenceId) evidenceIdSet.add(t.evidenceId);
  }
  for (const d of verificationDecisions) {
    if (d.evidenceId) evidenceIdSet.add(d.evidenceId);
  }
  if (baselineRow?.baselineEvidenceId) {
    evidenceIdSet.add(baselineRow.baselineEvidenceId);
  }

  const orderedEvidenceIds = [...evidenceIdSet].sort();

  let governanceRows: (typeof governanceEvidence.$inferSelect)[] = [];
  if (orderedEvidenceIds.length > 0) {
    governanceRows = await db
      .select()
      .from(governanceEvidence)
      .where(
        and(
          eq(governanceEvidence.userId, session.user.id),
          eq(governanceEvidence.workflowId, workflowId),
          inArray(governanceEvidence.id, orderedEvidenceIds),
        ),
      );
  }

  const governanceById = new Map(governanceRows.map((r) => [r.id, r] as const));

  const slicesBuilt = buildEvidenceSlicesMap(governanceRows);
  if (!slicesBuilt.ok) {
    return corruptedResponse(slicesBuilt.evidenceId);
  }
  const evidenceSlices = slicesBuilt.evidenceSlices;

  const baselineBaselineEvidenceSliceKey = baselineRow?.baselineEvidenceId ?? null;
  const baselinePayload = baselineRow
    ? {
        ...baselineRow,
        baselineEvidenceSliceKey: baselineBaselineEvidenceSliceKey,
      }
    : null;

  const baselineAcceptedEvidence =
    baselineRow?.baselineEvidenceId !== null &&
    baselineRow?.baselineEvidenceId !== undefined &&
    evidenceSlices[baselineRow.baselineEvidenceId]
      ? ({
          evidenceSliceKey: baselineRow.baselineEvidenceId,
          runId: evidenceSlices[baselineRow.baselineEvidenceId].runId,
          fingerprints: evidenceSlices[baselineRow.baselineEvidenceId].fingerprints,
          runKind: String(
            evidenceSlices[baselineRow.baselineEvidenceId].outcomeCertificate["runKind"] ?? "contract_sql",
          ),
        } satisfies {
          evidenceSliceKey: string;
          runId: string;
          fingerprints: { certificateSha256: string; materialTruthSha256: string };
          runKind: string;
        })
      : null;

  const lifecycle = lifecycleRows[0] ?? null;

  const payload = {
    schemaVersion: 3 as const,
    generatedAt: new Date().toISOString(),
    userId: session.user.id,
    workflowId,
    window: { from: from.toISOString(), to: to.toISOString() },
    lifecycle: lifecycle
      ? {
          lifecycleState: lifecycle.currentState,
          lifecycleStateVersion: lifecycle.stateVersion,
          pendingExpectedProjectionHashForAccept: lifecycle.pendingAcceptProjectionHash,
          updatedAt: lifecycle.updatedAt.toISOString(),
          lastFsmTransitionId: lifecycle.lastTransitionId,
        }
      : null,
    fsmTransitions,
    verificationDecisions,
    baseline: baselinePayload,
    events: eventRows.map((e) => ({
      ...e,
      evidenceSliceKey: e.evidenceId,
      evidence: e.evidenceId ? governanceById.get(e.evidenceId) ?? null : null,
    })),
    evidenceSlices,
    baselineAcceptedEvidence,
  };

  return NextResponse.json(payload, { status: 200 });
}
