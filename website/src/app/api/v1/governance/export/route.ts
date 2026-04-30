import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { OutcomeCertificateV1 } from "agentskeptic";
import { computeCompletenessFromParts } from "agentskeptic/decisionEvidenceBundle";
import { loadSchemaValidator } from "agentskeptic/schemaLoad";
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
import pkg from "../../../../../../package.json";

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

  const evidenceIds = [...new Set(eventRows.map((e) => e.evidenceId).filter((id): id is string => !!id))];
  const evidenceRows = evidenceIds.length
    ? await db
        .select()
        .from(governanceEvidence)
        .where(and(eq(governanceEvidence.userId, session.user.id), eq(governanceEvidence.workflowId, workflowId)))
    : [];
  const evidenceById = new Map(evidenceRows.map((e) => [e.id, e] as const));

  const latestEvidenceRows = await db
    .select({ certificateJson: governanceEvidence.certificateJson })
    .from(governanceEvidence)
    .where(and(eq(governanceEvidence.userId, session.user.id), eq(governanceEvidence.workflowId, workflowId)))
    .orderBy(desc(governanceEvidence.createdAt))
    .limit(1);

  let certificate: OutcomeCertificateV1 | null = null;
  let certificateValid = false;
  const rawCert = latestEvidenceRows[0]?.certificateJson;
  if (rawCert !== null && rawCert !== undefined && typeof rawCert === "object") {
    const validateCert = loadSchemaValidator("outcome-certificate-v1");
    if (validateCert(rawCert)) {
      certificateValid = true;
      certificate = rawCert as OutcomeCertificateV1;
    }
  }

  const computed = computeCompletenessFromParts({
    certificateValid,
    coreFilesPresent: certificate !== null && certificateValid,
    certificate,
    a4Present: false,
    a5Present: false,
  });

  const manifestPayload = {
    schemaVersion: 1 as const,
    bundleKind: "decision_evidence" as const,
    producer: { name: "agentskeptic-web", version: pkg.version },
    createdAt: new Date().toISOString(),
    workflowId,
    completeness: {
      status: computed.status,
      artifacts: computed.artifacts,
    },
  };

  const validateManifest = loadSchemaValidator("decision-evidence-bundle-manifest-v1");
  if (!validateManifest(manifestPayload)) {
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: `decision evidence manifest invalid: ${JSON.stringify(validateManifest.errors ?? [])}`,
      },
      { status: 500 },
    );
  }

  const decisionEvidenceExport = {
    manifest: manifestPayload,
    embedded: {
      outcomeCertificate: certificate,
      exit: {
        kind: "hosted_not_recorded" as const,
        reason: "Exit codes are client-local for CLI verify; not persisted in governance_evidence.",
      },
      humanLayer: certificate
        ? ({ kind: "from_certificate" as const, text: certificate.humanReport })
        : ({
            kind: "missing" as const,
            reason: "No governance_evidence row available for embedding.",
          }),
      attestation: null,
      nextAction: null,
    },
  };

  const baseline = baselineRows[0] ?? null;
  const lifecycle = lifecycleRows[0] ?? null;
  const payload = {
    schemaVersion: 2,
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
    baseline,
    events: eventRows.map((e) => ({
      ...e,
      evidence: e.evidenceId ? evidenceById.get(e.evidenceId) ?? null : null,
    })),
    decisionEvidenceExport,
  };
  return NextResponse.json(payload, { status: 200 });
}
