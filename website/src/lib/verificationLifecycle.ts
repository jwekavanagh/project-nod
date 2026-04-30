/**
 * Hosted enforcement lifecycle FSM — single logical authority for transitions.
 * Workflow posture: lifecycle_state ∈ {baseline_missing, baseline_active, action_required, rerun_required}
 * Verification outcomes: decision_* on POST /check and POST /baselines only (immutable per attempt_id).
 */

export const LIFECYCLE_STATES = [
  "baseline_missing",
  "baseline_active",
  "action_required",
  "rerun_required",
] as const;

export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const DECISION_STATES = ["decision_trusted", "decision_blocked"] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

/** Reason codes persisted on enforcement_decision.decision_reason_code */
export type DecisionReasonCode =
  | "BASELINE_MISSING"
  | "BASELINE_ESTABLISHED"
  | "CHECK_MATCH"
  | "DRIFT_DETECTED"
  | "RERUN_PASS"
  | "RERUN_FAIL"
  | "REMEDIATION_ACK_REQUIRED"
  | "HISTORICAL_UNMAPPABLE";

export const TRUST_BLOCKED_REASON_CODES = new Set<DecisionReasonCode>([
  "BASELINE_MISSING",
  "DRIFT_DETECTED",
  "RERUN_FAIL",
  "REMEDIATION_ACK_REQUIRED",
]);

export type ResultStatus = "match" | "drift" | "rerun_pass" | "rerun_fail";

export type ResponseCode =
  | "COMPLETED"
  | "ENFORCE_BASELINE_REQUIRED"
  | "ENFORCE_INVALID_TRANSITION"
  | "ENFORCE_STALE_STATE_VERSION"
  | "ENFORCE_EXPECTED_HASH_MISMATCH"
  | "ENFORCE_REMEDIATION_ACK_REQUIRED"
  | "ENFORCE_DECISION_GRADE_REQUIRED"
  | "ENFORCE_BASELINE_REBASE_REQUIRED";

/** Baseline authorize: contract run kinds unless explicit product override JSON field on request (future). */
export function isDecisionGradeRunKind(runKind: string): boolean {
  return runKind === "contract_sql" || runKind === "contract_sql_langgraph_checkpoint_trust";
}

/** Infer posture when enforcement_lifecycle row is absent (migration / legacy compatibility). */
export function inferLifecycleFromBaselineExists(baselineRowExists: boolean): LifecycleState {
  return baselineRowExists ? "baseline_active" : "baseline_missing";
}

export type CheckEvaluationInput = {
  lifecycleBefore: LifecycleState;
  baselineProjectionHash: string | null;
  /** Current stored baseline_hash from enforcement_baseline; null iff no baseline row */
  baselineRowExists: boolean;
  baselineNeedsRebaseline: boolean;
  observedMaterialTruthSha256: string;
};

export type CheckEvaluationOk = {
  kind: "ok";
  lifecycleAfter: LifecycleState;
  decisionState: DecisionState;
  decisionReasonCode: DecisionReasonCode;
  httpStatus: 200 | 409;
  responseCode: ResponseCode;
  resultStatus: ResultStatus;
  /** Set when drifting into action_required; otherwise null */
  pendingAcceptProjectionHash: string | null;
  nextAction: string;
};

export type CheckEvaluation = CheckEvaluationOk | { kind: "precondition"; httpStatus: 409; responseCode: ResponseCode; message: string };

/**
 * Preconditions (needsRebaseline): block before lifecycle math (preserve existing product guard).
 */
export function evaluateCheckPreconditions(input: CheckEvaluationInput): CheckEvaluation | null {
  if (input.baselineRowExists && input.baselineNeedsRebaseline) {
    return {
      kind: "precondition",
      httpStatus: 409,
      responseCode: "ENFORCE_BASELINE_REBASE_REQUIRED",
      message:
        "Baseline must be recreated with evidence-native enforce before drift checks can run.",
    };
  }
  return null;
}

export function evaluateCheck(input: CheckEvaluationInput): CheckEvaluationOk {
  const actual = input.observedMaterialTruthSha256;
  /** If baseline row exists, posture cannot remain baseline_missing (repair skew). */
  let lifeIn = input.lifecycleBefore;
  if (lifeIn === "baseline_missing" && input.baselineRowExists && input.baselineProjectionHash !== null) {
    lifeIn = "baseline_active";
  }
  input = { ...input, lifecycleBefore: lifeIn };

  /** No baseline row */
  if (!input.baselineRowExists || input.baselineProjectionHash === null) {
    return {
      kind: "ok",
      lifecycleAfter: "baseline_missing",
      decisionState: "decision_blocked",
      decisionReasonCode: "BASELINE_MISSING",
      httpStatus: 409,
      responseCode: "ENFORCE_BASELINE_REQUIRED",
      resultStatus: "drift",
      pendingAcceptProjectionHash: null,
      nextAction:
        "Run enforce with --create-baseline before POST /check.",
    };
  }

  const matches = actual === input.baselineProjectionHash;

  switch (input.lifecycleBefore) {
    case "baseline_missing": {
      return {
        kind: "ok",
        lifecycleAfter: "baseline_missing",
        decisionState: "decision_blocked",
        decisionReasonCode: "BASELINE_MISSING",
        httpStatus: 409,
        responseCode: "ENFORCE_BASELINE_REQUIRED",
        resultStatus: "drift",
        pendingAcceptProjectionHash: null,
        nextAction:
          "Run enforce with --create-baseline before POST /check.",
      };
    }
    case "baseline_active": {
      if (matches) {
        return {
          kind: "ok",
          lifecycleAfter: "baseline_active",
          decisionState: "decision_trusted",
          decisionReasonCode: "CHECK_MATCH",
          httpStatus: 200,
          responseCode: "COMPLETED",
          resultStatus: "match",
          pendingAcceptProjectionHash: null,
          nextAction: "No remediation required.",
        };
      }
      return {
        kind: "ok",
        lifecycleAfter: "action_required",
        decisionState: "decision_blocked",
        decisionReasonCode: "DRIFT_DETECTED",
        httpStatus: 200,
        responseCode: "COMPLETED",
        resultStatus: "drift",
        pendingAcceptProjectionHash: input.baselineProjectionHash,
        nextAction:
          "Drift detected. Review evidence, reconcile or accept with POST /enforce accept after matching expected_projection_hash_for_accept.",
      };
    }
    case "action_required": {
      if (matches) {
        return {
          kind: "ok",
          lifecycleAfter: "action_required",
          decisionState: "decision_blocked",
          decisionReasonCode: "REMEDIATION_ACK_REQUIRED",
          httpStatus: 409,
          responseCode: "ENFORCE_REMEDIATION_ACK_REQUIRED",
          resultStatus: "match",
          pendingAcceptProjectionHash: input.baselineProjectionHash,
          nextAction:
            "Material truth matches baseline; record acknowledgement via POST /accept before returning to baseline_active.",
        };
      }
      return {
        kind: "ok",
        lifecycleAfter: "action_required",
        decisionState: "decision_blocked",
        decisionReasonCode: "DRIFT_DETECTED",
        httpStatus: 200,
        responseCode: "COMPLETED",
        resultStatus: "drift",
        pendingAcceptProjectionHash: input.baselineProjectionHash,
        nextAction:
          "Drift still present. Continue remediation then POST /accept with expected_projection_hash_for_accept.",
      };
    }
    case "rerun_required": {
      if (matches) {
        return {
          kind: "ok",
          lifecycleAfter: "baseline_active",
          decisionState: "decision_trusted",
          decisionReasonCode: "RERUN_PASS",
          httpStatus: 200,
          responseCode: "COMPLETED",
          resultStatus: "rerun_pass",
          pendingAcceptProjectionHash: null,
          nextAction:
            "Rerun succeeded; posture returned to baseline_active.",
        };
      }
      return {
        kind: "ok",
        lifecycleAfter: "action_required",
        decisionState: "decision_blocked",
        decisionReasonCode: "RERUN_FAIL",
        httpStatus: 200,
        responseCode: "COMPLETED",
        resultStatus: "rerun_fail",
        pendingAcceptProjectionHash: input.baselineProjectionHash,
        nextAction:
          "Rerun verification still mismatched. Reconcile and POST /accept with expected_projection_hash_for_accept.",
      };
    }
  }
}

export type BaselineEvaluationInput = {
  lifecycleBefore: LifecycleState;
  runKind: string;
};

export type BaselineEvaluation =
  | {
      ok: true;
      lifecycleAfter: "baseline_active";
      decisionReasonCode: "BASELINE_ESTABLISHED";
      httpStatus: 200;
      responseCode: "COMPLETED";
      nextAction: string;
    }
  | {
      ok: false;
      httpStatus: 409;
      responseCode: "ENFORCE_DECISION_GRADE_REQUIRED" | "ENFORCE_INVALID_TRANSITION";
      message: string;
    };

export function evaluateCreateBaseline(input: BaselineEvaluationInput): BaselineEvaluation {
  if (input.lifecycleBefore !== "baseline_missing") {
    return {
      ok: false,
      httpStatus: 409,
      responseCode: "ENFORCE_INVALID_TRANSITION",
      message:
        "POST /baselines is only permitted when lifecycle_state is baseline_missing. Use POST /accept and POST /check to advance after drift.",
    };
  }
  if (!isDecisionGradeRunKind(input.runKind)) {
    return {
      ok: false,
      httpStatus: 409,
      responseCode: "ENFORCE_DECISION_GRADE_REQUIRED",
      message:
        "Evidence run_kind must be contract_sql or contract_sql_langgraph_checkpoint_trust for authoritative baseline establishment.",
    };
  }
  return {
    ok: true,
    lifecycleAfter: "baseline_active",
    decisionReasonCode: "BASELINE_ESTABLISHED",
    httpStatus: 200,
    responseCode: "COMPLETED",
    nextAction:
      "Baseline established. Subsequent checks use POST /check.",
  };
}

export type AcceptEvaluationInput = {
  lifecycleBefore: LifecycleState;
  lifecycleStateVersion: number;
  requestLifecycleVersion: number | null;
  requestExpectedProjectionHash: string | null;
  pendingAcceptProjectionHash: string | null;
  runKind: string;
};

export type AcceptEvaluation =
  | {
      ok: true;
      lifecycleAfter: "rerun_required";
      httpStatus: 200;
      responseCode: "COMPLETED";
      nextAction: string;
    }
  | {
      ok: false;
      httpStatus: 400 | 409;
      responseCode:
        | "BAD_REQUEST"
        | "ENFORCE_INVALID_TRANSITION"
        | "ENFORCE_STALE_STATE_VERSION"
        | "ENFORCE_EXPECTED_HASH_MISMATCH"
        | "ENFORCE_DECISION_GRADE_REQUIRED";
      message: string;
    };

export function evaluateAccept(input: AcceptEvaluationInput): AcceptEvaluation {
  if (input.lifecycleBefore !== "action_required") {
    return {
      ok: false,
      httpStatus: 409,
      responseCode: "ENFORCE_INVALID_TRANSITION",
      message: "POST /accept requires lifecycle_state action_required.",
    };
  }
  if (input.requestLifecycleVersion === null || !Number.isInteger(input.requestLifecycleVersion)) {
    return {
      ok: false,
      httpStatus: 400,
      responseCode: "BAD_REQUEST",
      message: "Missing lifecycle_state_version.",
    };
  }
  if (input.requestLifecycleVersion !== input.lifecycleStateVersion) {
    return {
      ok: false,
      httpStatus: 409,
      responseCode: "ENFORCE_STALE_STATE_VERSION",
      message: "lifecycle_state_version does not match current server posture.",
    };
  }
  if (!input.requestExpectedProjectionHash?.trim()) {
    return {
      ok: false,
      httpStatus: 400,
      responseCode: "BAD_REQUEST",
      message: "Missing expected_projection_hash.",
    };
  }
  if (
    !input.pendingAcceptProjectionHash ||
    input.requestExpectedProjectionHash !== input.pendingAcceptProjectionHash
  ) {
    return {
      ok: false,
      httpStatus: 409,
      responseCode: "ENFORCE_EXPECTED_HASH_MISMATCH",
      message:
        "expected_projection_hash must match expected_projection_hash_for_accept from the open drift POST /check response.",
    };
  }
  if (!isDecisionGradeRunKind(input.runKind)) {
    return {
      ok: false,
      httpStatus: 409,
      responseCode: "ENFORCE_DECISION_GRADE_REQUIRED",
      message:
        "Accept requires decision-grade outcome_certificate_v1.run_kind.",
    };
  }
  return {
    ok: true,
    lifecycleAfter: "rerun_required",
    httpStatus: 200,
    responseCode: "COMPLETED",
    nextAction:
      "Drift acknowledged; rerun POST /check to certify against updated baseline projection.",
  };
}

/** Normalized replay event for migrations / backtests (single reducer spine). */
export type FsmNormalizedEvent =
  | { kind: "legacy_baseline_created"; materialTruthSha256: string }
  | { kind: "legacy_check_pass"; materialTruthSha256: string }
  | { kind: "legacy_drift_detected"; expectedBaselineHash: string; actualTruthSha256: string }
  | { kind: "legacy_drift_accepted"; acceptedTruthSha256: string };

export type FsmReplayState = {
  lifecycle: LifecycleState;
  baselineHash: string | null;
  /** Open drift expectation (accepted baseline fingerprint before reconcile) — mirrors pending_accept_projection_hash */
  pendingAcceptHash: string | null;
};

export type FsmReplayResult =
  | { ok: true; state: FsmReplayState }
  | { ok: false; fatal: true; reason: "HISTORICAL_UNMAPPABLE" };

/**
 * Replay one legacy-derived event toward derived lifecycle posture.
 * Conservative: emits fatal when legacy ordering contradicts closed-loop semantics (cannot auto-trust past action_required gap).
 */
export function applyFsmNormalizedEvent(prev: FsmReplayState, ev: FsmNormalizedEvent): FsmReplayResult {
  const clone = (): FsmReplayState => ({
    lifecycle: prev.lifecycle,
    baselineHash: prev.baselineHash,
    pendingAcceptHash: prev.pendingAcceptHash,
  });

  if (ev.kind === "legacy_baseline_created") {
    const s = clone();
    s.baselineHash = ev.materialTruthSha256;
    s.lifecycle = "baseline_active";
    s.pendingAcceptHash = null;
    return { ok: true, state: s };
  }

  if (ev.kind === "legacy_drift_accepted") {
    const s = clone();
    s.baselineHash = ev.acceptedTruthSha256;
    s.lifecycle = "rerun_required";
    s.pendingAcceptHash = null;
    return { ok: true, state: s };
  }

  if (ev.kind === "legacy_check_pass") {
    const actual = ev.materialTruthSha256;
    const bh = prev.baselineHash;
    const s = clone();

    if (!bh) {
      s.lifecycle = "baseline_missing";
      return { ok: true, state: s };
    }

    if (prev.lifecycle === "action_required") {
      if (actual !== bh) {
        s.lifecycle = "action_required";
        s.pendingAcceptHash = bh;
        return { ok: true, state: s };
      }
      /** Match while action_required without recorded accept in stream — violates new G8 */
      return { ok: false, fatal: true, reason: "HISTORICAL_UNMAPPABLE" };
    }

    if (actual === bh) {
      if (prev.lifecycle === "rerun_required") {
        s.lifecycle = "baseline_active";
        s.pendingAcceptHash = null;
        return { ok: true, state: s };
      }
      if (prev.lifecycle === "baseline_active") {
        s.lifecycle = "baseline_active";
        s.pendingAcceptHash = null;
        return { ok: true, state: s };
      }
    }

    /** Drift transitions */
    if (prev.lifecycle === "rerun_required" && actual !== bh) {
      s.lifecycle = "action_required";
      s.pendingAcceptHash = bh;
      return { ok: true, state: s };
    }
    if (prev.lifecycle === "baseline_active" && actual !== bh) {
      s.lifecycle = "action_required";
      s.pendingAcceptHash = bh;
      return { ok: true, state: s };
    }
    if (prev.lifecycle === "baseline_missing") {
      s.lifecycle = "baseline_missing";
      return { ok: true, state: s };
    }
    return { ok: false, fatal: true, reason: "HISTORICAL_UNMAPPABLE" };
  }

  if (ev.kind === "legacy_drift_detected") {
    const s = clone();
    s.lifecycle = "action_required";
    s.pendingAcceptHash = ev.expectedBaselineHash ?? s.baselineHash;
    /** Keep baseline_hash as stored until accept updates it */
    return { ok: true, state: s };
  }

  return { ok: false, fatal: true, reason: "HISTORICAL_UNMAPPABLE" };
}
