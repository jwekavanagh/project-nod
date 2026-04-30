import { describe, expect, it } from "vitest";
import {
  applyFsmNormalizedEvent,
  evaluateAccept,
  evaluateCheck,
  evaluateCheckPreconditions,
  evaluateCreateBaseline,
  type FsmReplayState,
} from "@/lib/verificationLifecycle";

describe("evaluateCreateBaseline", () => {
  it("allows only from baseline_missing", () => {
    const ok = evaluateCreateBaseline({ lifecycleBefore: "baseline_missing", runKind: "contract_sql" });
    expect(ok.ok).toBe(true);
    for (const life of ["baseline_active", "action_required", "rerun_required"] as const) {
      const bad = evaluateCreateBaseline({ lifecycleBefore: life, runKind: "contract_sql" });
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.responseCode).toBe("ENFORCE_INVALID_TRANSITION");
    }
  });

  it("rejects quick_preview for authoritative baseline establishment", () => {
    const r = evaluateCreateBaseline({ lifecycleBefore: "baseline_missing", runKind: "quick_preview" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.responseCode).toBe("ENFORCE_DECISION_GRADE_REQUIRED");
  });
});

describe("evaluateCheck", () => {
  it("blocks with BASELINE_MISSING when no baseline row", () => {
    const r = evaluateCheck({
      lifecycleBefore: "baseline_missing",
      baselineProjectionHash: null,
      baselineRowExists: false,
      baselineNeedsRebaseline: false,
      observedMaterialTruthSha256: "x",
    });
    expect(r.decisionReasonCode).toBe("BASELINE_MISSING");
    expect(r.httpStatus).toBe(409);
  });

  it("matches from baseline_active", () => {
    const r = evaluateCheck({
      lifecycleBefore: "baseline_active",
      baselineProjectionHash: "h1",
      baselineRowExists: true,
      baselineNeedsRebaseline: false,
      observedMaterialTruthSha256: "h1",
    });
    expect(r.decisionReasonCode).toBe("CHECK_MATCH");
    expect(r.httpStatus).toBe(200);
    expect(r.lifecycleAfter).toBe("baseline_active");
  });

  it("drifts from baseline_active into action_required with pending accept hash", () => {
    const r = evaluateCheck({
      lifecycleBefore: "baseline_active",
      baselineProjectionHash: "h1",
      baselineRowExists: true,
      baselineNeedsRebaseline: false,
      observedMaterialTruthSha256: "h2",
    });
    expect(r.decisionReasonCode).toBe("DRIFT_DETECTED");
    expect(r.lifecycleAfter).toBe("action_required");
    expect(r.pendingAcceptProjectionHash).toBe("h1");
    expect(r.httpStatus).toBe(200);
  });

  it("G8: match from action_required requires accept (409)", () => {
    const r = evaluateCheck({
      lifecycleBefore: "action_required",
      baselineProjectionHash: "h1",
      baselineRowExists: true,
      baselineNeedsRebaseline: false,
      observedMaterialTruthSha256: "h1",
    });
    expect(r.httpStatus).toBe(409);
    expect(r.decisionReasonCode).toBe("REMEDIATION_ACK_REQUIRED");
  });

  it("G7: rerun_pass only when entering from rerun_required with hash match", () => {
    const r = evaluateCheck({
      lifecycleBefore: "rerun_required",
      baselineProjectionHash: "h2",
      baselineRowExists: true,
      baselineNeedsRebaseline: false,
      observedMaterialTruthSha256: "h2",
    });
    expect(r.decisionReasonCode).toBe("RERUN_PASS");
    expect(r.lifecycleAfter).toBe("baseline_active");
    expect(r.resultStatus).toBe("rerun_pass");
  });

  it("rerun_required mismatch produces RERUN_FAIL", () => {
    const r = evaluateCheck({
      lifecycleBefore: "rerun_required",
      baselineProjectionHash: "h2",
      baselineRowExists: true,
      baselineNeedsRebaseline: false,
      observedMaterialTruthSha256: "h3",
    });
    expect(r.decisionReasonCode).toBe("RERUN_FAIL");
    expect(r.lifecycleAfter).toBe("action_required");
    expect(r.resultStatus).toBe("rerun_fail");
  });
});

describe("evaluateCheckPreconditions", () => {
  it("rebase flag blocks before evaluation", () => {
    const pre = evaluateCheckPreconditions({
      lifecycleBefore: "baseline_active",
      baselineProjectionHash: "h",
      baselineRowExists: true,
      baselineNeedsRebaseline: true,
      observedMaterialTruthSha256: "h",
    });
    expect(pre?.kind).toBe("precondition");
    if (pre?.kind === "precondition") expect(pre.responseCode).toBe("ENFORCE_BASELINE_REBASE_REQUIRED");
  });
});

describe("evaluateAccept", () => {
  const baseAccept = () => ({
    lifecycleBefore: "action_required" as const,
    lifecycleStateVersion: 3,
    requestLifecycleVersion: 3,
    requestExpectedProjectionHash: "pinned",
    pendingAcceptProjectionHash: "pinned",
    runKind: "contract_sql" as const,
  });

  it("accepts valid pin", () => {
    expect(evaluateAccept(baseAccept()).ok).toBe(true);
  });

  it("requires action_required posture", () => {
    const r = evaluateAccept({ ...baseAccept(), lifecycleBefore: "baseline_active" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.responseCode).toBe("ENFORCE_INVALID_TRANSITION");
  });

  it("rejects stale version", () => {
    const r = evaluateAccept({ ...baseAccept(), requestLifecycleVersion: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.responseCode).toBe("ENFORCE_STALE_STATE_VERSION");
  });

  it("rejects hash pin mismatch", () => {
    const r = evaluateAccept({ ...baseAccept(), requestExpectedProjectionHash: "other" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.responseCode).toBe("ENFORCE_EXPECTED_HASH_MISMATCH");
  });
});

describe("applyFsmNormalizedEvent", () => {
  const init: FsmReplayState = {
    lifecycle: "baseline_missing",
    baselineHash: null,
    pendingAcceptHash: null,
  };

  it("replays baseline create", () => {
    let s = init;
    const r = applyFsmNormalizedEvent(s, { kind: "legacy_baseline_created", materialTruthSha256: "b1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.baselineHash).toBe("b1");
      expect(r.state.lifecycle).toBe("baseline_active");
    }
  });

  it("flags impossible check_pass under action_required + match (G8 gap)", () => {
    const s: FsmReplayState = {
      lifecycle: "action_required",
      baselineHash: "h1",
      pendingAcceptHash: "h1",
    };
    const r = applyFsmNormalizedEvent(s, { kind: "legacy_check_pass", materialTruthSha256: "h1" });
    expect(r.ok).toBe(false);
  });
});
