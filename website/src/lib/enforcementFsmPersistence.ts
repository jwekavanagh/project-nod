import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  enforcementBaselines,
  enforcementDecision,
  enforcementEvents,
  enforcementFsmTransition,
  enforcementLifecycle,
  trustDecisionReceipts,
} from "@/db/schema";
import type { EnforcementAcceptEvidenceInput, EnforcementEvidenceInput } from "@/lib/enforcementState";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import type { DecisionReasonCode, LifecycleState } from "@/lib/verificationLifecycle";
import {
  evaluateAccept,
  evaluateCheck,
  evaluateCheckPreconditions,
  evaluateCreateBaseline,
  inferLifecycleFromBaselineExists,
  TRUST_BLOCKED_REASON_CODES,
} from "@/lib/verificationLifecycle";
import { logFunnelEvent } from "@/lib/funnelEvent";
import type { ApiKeyPrincipal } from "@/lib/apiKeyAuthGateway";
import { trustDecisionFingerprintHex } from "@/lib/trustDecisionFingerprint";
import { buildHostedEnforcementTrustBlockRecord } from "@/lib/hostedEnforcementTrustBlock";

type DbTx = PostgresJsDatabase<typeof schema>;

async function upsertBaselineTx(
  tx: DbTx,
  input: {
    userId: string;
    keyId: string;
    workflowId: string;
    projectionHash: string;
    projection: unknown;
    baselineEvidenceId?: string;
    needsRebaseline?: boolean;
  },
): Promise<void> {
  const existing = await tx
    .select()
    .from(enforcementBaselines)
    .where(and(eq(enforcementBaselines.userId, input.userId), eq(enforcementBaselines.workflowId, input.workflowId)))
    .limit(1);
  if (existing.length === 0) {
    await tx.insert(enforcementBaselines).values({
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
  await tx
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

function appendEnforcementEventTx(tx: DbTx, input: {
  userId: string;
  workflowId: string;
  runId: string;
  event: "baseline_created" | "check_pass" | "drift_detected" | "drift_accepted";
  expectedProjectionHash: string | null;
  actualProjectionHash: string;
  evidenceId?: string;
  metadata?: Record<string, unknown>;
}) {
  return tx.insert(enforcementEvents).values({
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

function classificationFromCert(cert: EnforcementEvidenceInput["outcome_certificate_v1"]): {
  classificationCode: string;
  recommendedAction: string;
  automationSafe: boolean;
} {
  const codes = cert.explanation.details.map((d) => d.code).filter(Boolean);
  const primary = codes.sort()[0] ?? "UNKNOWN";
  const reconcile =
    cert.stateRelation === "does_not_match" || cert.runKind !== "quick_preview";
  return {
    classificationCode: primary,
    recommendedAction: reconcile ? "reconcile_downstream_state" : "manual_review",
    automationSafe: cert.runKind !== "quick_preview" && codes.length === 0,
  };
}

async function ensureLifecycleRow(
  tx: DbTx,
  userId: string,
  workflowId: string,
  baselineRowExists: boolean,
): Promise<typeof enforcementLifecycle.$inferSelect> {
  const existing = await tx
    .select()
    .from(enforcementLifecycle)
    .where(and(eq(enforcementLifecycle.userId, userId), eq(enforcementLifecycle.workflowId, workflowId)))
    .for("update")
    .limit(1);

  if (existing.length > 0) {
    let row = existing[0]!;
    if (
      row.currentState === "baseline_missing" &&
      baselineRowExists
    ) {
      const bumped = row.stateVersion + 1;
      await tx
        .update(enforcementLifecycle)
        .set({
          currentState: "baseline_active",
          updatedAt: new Date(),
          stateVersion: bumped,
        })
        .where(
          and(
            eq(enforcementLifecycle.userId, userId),
            eq(enforcementLifecycle.workflowId, workflowId),
            eq(enforcementLifecycle.currentState, "baseline_missing"),
          ),
        );
      const refreshed = await tx
        .select()
        .from(enforcementLifecycle)
        .where(and(eq(enforcementLifecycle.userId, userId), eq(enforcementLifecycle.workflowId, workflowId)))
        .limit(1);
      row = refreshed[0]!;
    }
    return row;
  }

  const initial = inferLifecycleFromBaselineExists(baselineRowExists);
  await tx.insert(enforcementLifecycle).values({
    userId,
    workflowId,
    currentState: initial,
    stateVersion: 0,
    pendingAcceptProjectionHash: null,
    lastTransitionId: null,
  });
  const inserted = await tx
    .select()
    .from(enforcementLifecycle)
    .where(and(eq(enforcementLifecycle.userId, userId), eq(enforcementLifecycle.workflowId, workflowId)))
    .for("update")
    .limit(1);
  return inserted[0]!;
}

async function persistTrustBlockedSideEffects(
  tx: DbTx,
  input: {
    apiKeyId: string;
    userId: string;
    certificate: EnforcementEvidenceInput["outcome_certificate_v1"];
    decisionReasonCode: string;
    attemptId: string;
  },
): Promise<string | null> {
  const record = buildHostedEnforcementTrustBlockRecord({
    certificate: input.certificate,
    decisionReasonCode: input.decisionReasonCode,
    attemptId: input.attemptId,
  });
  const fingerprint = trustDecisionFingerprintHex(record);
  const inserted = await tx
    .insert(trustDecisionReceipts)
    .values({ apiKeyId: input.apiKeyId, fingerprintSha256: fingerprint })
    .onConflictDoNothing()
    .returning({ fingerprintSha256: trustDecisionReceipts.fingerprintSha256 });
  if (inserted.length > 0) {
    await logFunnelEvent(
      {
        event: "trust_decision_blocked",
        userId: input.userId,
        metadata: record,
      },
      tx,
    );
  }
  return fingerprint;
}

/** POST /check — persists decision + transitions + posture; mirrors legacy drift event when applicable */
export async function executeFsmCheck(params: {
  principal: ApiKeyPrincipal;
  body: EnforcementEvidenceInput;
  verified: {
    certificateSha256: string;
    materialTruthSha256: string;
    materialTruth: Record<string, unknown>;
  };
  evidenceId: string;
}) {
  const { principal, body, verified, evidenceId } = params;
  return await db.transaction(async (tx) => {
    const baseline = await tx
      .select()
      .from(enforcementBaselines)
      .where(and(eq(enforcementBaselines.userId, principal.userId), eq(enforcementBaselines.workflowId, body.workflow_id)))
      .limit(1);
    const baselineRow = baseline[0] ?? null;
    const lifeRowStart = await ensureLifecycleRow(tx, principal.userId, body.workflow_id, !!baselineRow);

    const precondition = evaluateCheckPreconditions({
      lifecycleBefore: lifeRowStart.currentState as LifecycleState,
      baselineProjectionHash: baselineRow?.projectionHash ?? null,
      baselineRowExists: !!baselineRow,
      baselineNeedsRebaseline: baselineRow?.needsRebaseline ?? false,
      observedMaterialTruthSha256: verified.materialTruthSha256,
    });
    if (precondition && precondition.kind === "precondition") {
      return {
        httpStatus: 409 as const,
        payload: {
          schema_version: 2,
          code: precondition.responseCode,
          message: precondition.message,
        },
      };
    }

    const evalResult = evaluateCheck({
      lifecycleBefore: lifeRowStart.currentState as LifecycleState,
      baselineProjectionHash: baselineRow?.projectionHash ?? null,
      baselineRowExists: !!baselineRow,
      baselineNeedsRebaseline: baselineRow?.needsRebaseline ?? false,
      observedMaterialTruthSha256: verified.materialTruthSha256,
    });
    const cls = classificationFromCert(body.outcome_certificate_v1);
    const attemptId = randomUUID();
    const fromState = lifeRowStart.currentState as LifecycleState;
    const lifecycleAfter = evalResult.lifecycleAfter;
    const decisionStateDb =
      evalResult.decisionState === "decision_trusted" ? ("decision_trusted" as const) : ("decision_blocked" as const);

    const nextVersion = lifeRowStart.stateVersion + 1;

    const shouldPersistTrustBlocked =
      evalResult.decisionState === "decision_blocked" &&
      TRUST_BLOCKED_REASON_CODES.has(evalResult.decisionReasonCode as DecisionReasonCode);
    const trustFp = shouldPersistTrustBlocked
      ? await persistTrustBlockedSideEffects(tx, {
          apiKeyId: principal.keyId,
          userId: principal.userId,
          certificate: body.outcome_certificate_v1,
          decisionReasonCode: evalResult.decisionReasonCode,
          attemptId,
        })
      : null;

    await tx.insert(enforcementDecision).values({
      attemptId,
      userId: principal.userId,
      workflowId: body.workflow_id,
      runId: body.run_id,
      decisionState: decisionStateDb,
      decisionReasonCode: evalResult.decisionReasonCode,
      lifecycleStateBefore: fromState,
      lifecycleStateAfter: lifecycleAfter,
      materialTruthSha256: verified.materialTruthSha256,
      certificateSha256: verified.certificateSha256,
      evidenceId,
      httpStatus: evalResult.httpStatus,
      recommendedAction: evalResult.nextAction,
      automationSafe: cls.automationSafe,
      classificationCode: cls.classificationCode,
      trustBlockFingerprintSha256: trustFp ?? null,
    });

    const [transitionRow] = await tx
      .insert(enforcementFsmTransition)
      .values({
        userId: principal.userId,
        workflowId: body.workflow_id,
        runId: body.run_id,
        eventKind: "check",
        fromState,
        toState: lifecycleAfter,
        lifecycleStateVersionAfter: nextVersion,
        expectedProjectionHash: baselineRow?.projectionHash ?? null,
        actualProjectionHash: verified.materialTruthSha256,
        evidenceId,
        metadata: {
          attempt_id: attemptId,
          decision_reason_code: evalResult.decisionReasonCode,
          run_kind: body.outcome_certificate_v1.runKind,
        },
      })
      .returning({ id: enforcementFsmTransition.id });

    const upd = await tx
      .update(enforcementLifecycle)
      .set({
        currentState: lifecycleAfter,
        stateVersion: nextVersion,
        pendingAcceptProjectionHash: evalResult.pendingAcceptProjectionHash,
        lastTransitionId: transitionRow!.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enforcementLifecycle.userId, principal.userId),
          eq(enforcementLifecycle.workflowId, body.workflow_id),
          eq(enforcementLifecycle.stateVersion, lifeRowStart.stateVersion),
        ),
      )
      .returning({ userId: enforcementLifecycle.userId });
    if (!upd.length) {
      throw new Error("lifecycle optimistic lock conflict on enforcement check");
    }

    await appendEnforcementEventTx(tx, {
      userId: principal.userId,
      workflowId: body.workflow_id,
      runId: body.run_id,
      event:
        evalResult.decisionReasonCode === "CHECK_MATCH" || evalResult.decisionReasonCode === "RERUN_PASS"
          ? "check_pass"
          : "drift_detected",
      expectedProjectionHash: baselineRow?.projectionHash ?? null,
      actualProjectionHash: verified.materialTruthSha256,
      evidenceId,
      metadata: {
        certificate_sha256: verified.certificateSha256,
        run_kind: body.outcome_certificate_v1.runKind,
        attempt_id: attemptId,
      },
    });

    const expectAccept =
      lifecycleAfter === "action_required" && evalResult.pendingAcceptProjectionHash
        ? evalResult.pendingAcceptProjectionHash
        : null;

    const basePayload =
      evalResult.httpStatus === 409
        ? {
            schema_version: 2,
            code: evalResult.responseCode,
            lifecycle_state: lifecycleAfter,
            lifecycle_state_version: nextVersion,
            decision_state:
              decisionStateDb === "decision_trusted" ? "decision_trusted" : ("decision_blocked" as const),
            decision_reason_code: evalResult.decisionReasonCode,
            attempt_id: attemptId,
            workflow_id: body.workflow_id,
            run_id: body.run_id,
            next_action: evalResult.nextAction,
          }
        : {
            schema_version: 2,
            code: "COMPLETED" as const,
            lifecycle_state: lifecycleAfter,
            lifecycle_state_version: nextVersion,
            result_status: evalResult.resultStatus,
            decision_state:
              decisionStateDb === "decision_trusted" ? "decision_trusted" : ("decision_blocked" as const),
            decision_reason_code: evalResult.decisionReasonCode,
            attempt_id: attemptId,
            workflow_id: body.workflow_id,
            run_id: body.run_id,
            expected_projection_hash_for_accept: expectAccept,
            actual_projection_hash: verified.materialTruthSha256,
            next_action: evalResult.nextAction,
            quota_enforced_via_reserve: true,
          };

    return { httpStatus: evalResult.httpStatus, payload: basePayload };
  });
}

/** POST /baselines */
export async function executeFsmCreateBaseline(params: {
  principal: ApiKeyPrincipal;
  body: EnforcementEvidenceInput;
  verified: { certificateSha256: string; materialTruthSha256: string; materialTruth: Record<string, unknown> };
  evidenceId: string;
}) {
  const { principal, body, verified, evidenceId } = params;
  return await db.transaction(async (tx) => {
    const baseline = await tx
      .select()
      .from(enforcementBaselines)
      .where(and(eq(enforcementBaselines.userId, principal.userId), eq(enforcementBaselines.workflowId, body.workflow_id)))
      .limit(1);

    const lifeRow = await ensureLifecycleRow(tx, principal.userId, body.workflow_id, !!baseline[0]);

    const verdict = evaluateCreateBaseline({
      lifecycleBefore: lifeRow.currentState as LifecycleState,
      runKind: body.outcome_certificate_v1.runKind,
    });
    if (!verdict.ok) {
      return {
        httpStatus: verdict.httpStatus,
        payload: {
          schema_version: 2,
          code: verdict.responseCode,
          message: verdict.message,
        },
      };
    }

    const attemptId = randomUUID();
    const fromState = lifeRow.currentState as LifecycleState;
    const nextVersion = lifeRow.stateVersion + 1;

    await upsertBaselineTx(tx, {
      userId: principal.userId,
      keyId: principal.keyId,
      workflowId: body.workflow_id,
      projectionHash: verified.materialTruthSha256,
      projection: verified.materialTruth,
      baselineEvidenceId: evidenceId,
      needsRebaseline: false,
    });

    await tx.insert(enforcementDecision).values({
      attemptId,
      userId: principal.userId,
      workflowId: body.workflow_id,
      runId: body.run_id,
      decisionState: "decision_trusted",
      decisionReasonCode: "BASELINE_ESTABLISHED",
      lifecycleStateBefore: fromState,
      lifecycleStateAfter: "baseline_active",
      materialTruthSha256: verified.materialTruthSha256,
      certificateSha256: verified.certificateSha256,
      evidenceId,
      httpStatus: 200,
      recommendedAction: verdict.nextAction,
      automationSafe: false,
      classificationCode: null,
      trustBlockFingerprintSha256: null,
    });

    const [transitionRow] = await tx
      .insert(enforcementFsmTransition)
      .values({
        userId: principal.userId,
        workflowId: body.workflow_id,
        runId: body.run_id,
        eventKind: "baseline_create",
        fromState,
        toState: "baseline_active",
        lifecycleStateVersionAfter: nextVersion,
        expectedProjectionHash: null,
        actualProjectionHash: verified.materialTruthSha256,
        evidenceId,
        metadata: { attempt_id: attemptId },
      })
      .returning({ id: enforcementFsmTransition.id });

    const lifecycleUp = await tx
      .update(enforcementLifecycle)
      .set({
        currentState: "baseline_active",
        stateVersion: nextVersion,
        pendingAcceptProjectionHash: null,
        lastTransitionId: transitionRow!.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enforcementLifecycle.userId, principal.userId),
          eq(enforcementLifecycle.workflowId, body.workflow_id),
          eq(enforcementLifecycle.stateVersion, lifeRow.stateVersion),
        ),
      )
      .returning({ userId: enforcementLifecycle.userId });
    if (!lifecycleUp.length) {
      throw new Error("lifecycle optimistic lock conflict on baseline create");
    }

    await appendEnforcementEventTx(tx, {
      userId: principal.userId,
      workflowId: body.workflow_id,
      runId: body.run_id,
      event: "baseline_created",
      expectedProjectionHash: null,
      actualProjectionHash: verified.materialTruthSha256,
      evidenceId,
      metadata: {
        certificate_sha256: verified.certificateSha256,
        run_kind: body.outcome_certificate_v1.runKind,
        attempt_id: attemptId,
      },
    });

    return {
      httpStatus: 200 as const,
      payload: {
        schema_version: 2,
        code: "COMPLETED" as const,
        lifecycle_state: "baseline_active" as const,
        lifecycle_state_version: nextVersion,
        decision_state: "decision_trusted" as const,
        decision_reason_code: "BASELINE_ESTABLISHED" as const,
        attempt_id: attemptId,
        workflow_id: body.workflow_id,
        run_id: body.run_id,
        actual_projection_hash: verified.materialTruthSha256,
        next_action: verdict.nextAction,
        quota_enforced_via_reserve: true,
      },
    };
  });
}

/** POST /accept */
export async function executeFsmAcceptDrift(params: {
  principal: ApiKeyPrincipal;
  body: EnforcementAcceptEvidenceInput;
  verified: { certificateSha256: string; materialTruthSha256: string; materialTruth: Record<string, unknown> };
  evidenceId: string;
}) {
  const { principal, body, verified, evidenceId } = params;
  return await db.transaction(async (tx) => {
    const baselineRows = await tx
      .select()
      .from(enforcementBaselines)
      .where(and(eq(enforcementBaselines.userId, principal.userId), eq(enforcementBaselines.workflowId, body.workflow_id)))
      .limit(1);
    const baselineRow = baselineRows[0] ?? null;

    const lifeRow = await ensureLifecycleRow(tx, principal.userId, body.workflow_id, !!baselineRow);
    const acceptEv = evaluateAccept({
      lifecycleBefore: lifeRow.currentState as LifecycleState,
      lifecycleStateVersion: lifeRow.stateVersion,
      requestLifecycleVersion: body.lifecycle_state_version,
      requestExpectedProjectionHash: body.expected_projection_hash,
      pendingAcceptProjectionHash: lifeRow.pendingAcceptProjectionHash,
      runKind: body.outcome_certificate_v1.runKind,
    });
    if (!acceptEv.ok) {
      return {
        httpStatus: acceptEv.httpStatus,
        payload:
          acceptEv.responseCode === "BAD_REQUEST"
            ? { schema_version: 2, code: acceptEv.responseCode, message: acceptEv.message }
            : {
                schema_version: 2,
                code: acceptEv.responseCode,
                lifecycle_state: lifeRow.currentState,
                lifecycle_state_version: lifeRow.stateVersion,
                message: acceptEv.message,
              },
      };
    }

    const nextVersion = lifeRow.stateVersion + 1;

    await upsertBaselineTx(tx, {
      userId: principal.userId,
      keyId: principal.keyId,
      workflowId: body.workflow_id,
      projectionHash: verified.materialTruthSha256,
      projection: verified.materialTruth,
      baselineEvidenceId: evidenceId,
      needsRebaseline: false,
    });

    const [transitionRow] = await tx
      .insert(enforcementFsmTransition)
      .values({
        userId: principal.userId,
        workflowId: body.workflow_id,
        runId: body.run_id,
        eventKind: "accept_drift",
        fromState: "action_required",
        toState: "rerun_required",
        lifecycleStateVersionAfter: nextVersion,
        expectedProjectionHash: body.expected_projection_hash,
        actualProjectionHash: verified.materialTruthSha256,
        evidenceId,
        metadata: {
          certificate_sha256: verified.certificateSha256,
          run_kind: body.outcome_certificate_v1.runKind,
        },
      })
      .returning({ id: enforcementFsmTransition.id });

    const acceptLifecycleUp = await tx
      .update(enforcementLifecycle)
      .set({
        currentState: "rerun_required",
        stateVersion: nextVersion,
        pendingAcceptProjectionHash: null,
        lastTransitionId: transitionRow!.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enforcementLifecycle.userId, principal.userId),
          eq(enforcementLifecycle.workflowId, body.workflow_id),
          eq(enforcementLifecycle.stateVersion, lifeRow.stateVersion),
        ),
      )
      .returning({ userId: enforcementLifecycle.userId });
    if (!acceptLifecycleUp.length) {
      throw new Error("lifecycle optimistic lock conflict on drift accept");
    }

    await appendEnforcementEventTx(tx, {
      userId: principal.userId,
      workflowId: body.workflow_id,
      runId: body.run_id,
      event: "drift_accepted",
      expectedProjectionHash: body.expected_projection_hash,
      actualProjectionHash: verified.materialTruthSha256,
      evidenceId,
      metadata: {
        certificate_sha256: verified.certificateSha256,
        run_kind: body.outcome_certificate_v1.runKind,
      },
    });

    return {
      httpStatus: 200 as const,
      payload: {
        schema_version: 2,
        code: "COMPLETED" as const,
        lifecycle_state: "rerun_required" as const,
        lifecycle_state_version: nextVersion,
        decision_state: null,
        decision_reason_code: null,
        workflow_id: body.workflow_id,
        run_id: body.run_id,
        accepted_projection_hash: verified.materialTruthSha256,
        next_action: acceptEv.nextAction,
        quota_enforced_via_reserve: true,
      },
    };
  });
}
