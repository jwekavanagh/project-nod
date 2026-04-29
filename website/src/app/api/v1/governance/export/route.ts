import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { enforcementBaselines, enforcementEvents, governanceEvidence } from "@/db/schema";

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

  const evidenceIds = [...new Set(eventRows.map((e) => e.evidenceId).filter((id): id is string => !!id))];
  const evidenceRows = evidenceIds.length
    ? await db
        .select()
        .from(governanceEvidence)
        .where(and(eq(governanceEvidence.userId, session.user.id), eq(governanceEvidence.workflowId, workflowId)))
    : [];
  const evidenceById = new Map(evidenceRows.map((e) => [e.id, e] as const));

  const baseline = baselineRows[0] ?? null;
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    userId: session.user.id,
    workflowId,
    window: { from: from.toISOString(), to: to.toISOString() },
    baseline,
    events: eventRows.map((e) => ({
      ...e,
      evidence: e.evidenceId ? evidenceById.get(e.evidenceId) ?? null : null,
    })),
  };
  return NextResponse.json(payload, { status: 200 });
}
