from __future__ import annotations

from typing import Any

from agentskeptic.kernel.resolve_expectation import REGISTRY_RESOLVER_CODE, UNKNOWN_TOOL
from agentskeptic.kernel.reconciler_sqlite import SQL_VERIFICATION_OUTCOME_CODE
from agentskeptic.kernel.verification_run_context import create_empty_verification_run_context

ACTION_INPUT_REASON_CODES = {UNKNOWN_TOOL, *REGISTRY_RESOLVER_CODE.values()}

RECONCILER_STEP_REASON_CODES = set(SQL_VERIFICATION_OUTCOME_CODE.values())

EXECUTION_PATH_FINDING_CODES = {
    "RETRIEVAL_EMPTY",
    "RETRIEVAL_ERROR",
    "RETRIEVAL_THIN_HITS",
    "NO_RETRIEVAL_EVENTS",
    "MODEL_TURN_ABNORMAL",
    "CONTROL_INTERRUPT",
    "BRANCH_OR_GATE_SKIPPED",
    "TOOL_SKIPPED",
    "ACTION_INPUT_RESOLUTION_FAILED",
    "MISSING_RUN_COMPLETED",
    "LOGICAL_STEP_RETRIES",
    "RETRY_OBSERVATIONS_DIVERGE",
    "LAST_EVENT_MODEL_ABNORMAL",
    "RUN_LEVEL_INGEST_ISSUES",
    "EVENT_SEQUENCE_IRREGULAR",
}

RECONCILER_CODE_OK_AS_PATH_FINDING_CODE = {SQL_VERIFICATION_OUTCOME_CODE["RETRY_OBSERVATIONS_DIVERGE"]}


def _push(out: list[dict[str, Any]], f: dict[str, Any]) -> None:
    out.append(f)


def _dedupe_findings(findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for f in findings:
        ev = f["evidence"]
        ing = ev.get("ingestIndex", -1)
        seq = ev.get("seq", -1)
        tid = ev.get("toolId", "")
        key = f"{f['code']}\0{ing}\0{seq}\0{tid}"
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


def build_execution_path_findings(engine: dict[str, Any]) -> list[dict[str, Any]]:
    ctx = engine.get("verificationRunContext") or create_empty_verification_run_context()
    out: list[dict[str, Any]] = []

    if len(engine.get("runLevelReasons", [])) > 0:
        codes = sorted({r["code"] for r in engine["runLevelReasons"]})
        _push(
            out,
            {
                "code": "RUN_LEVEL_INGEST_ISSUES",
                "severity": "high",
                "concernCategory": "capture_integrity",
                "message": f"Run-level ingest or parse issues ({','.join(codes)}).",
                "evidence": {"scope": "run_level", "codes": codes},
            },
        )

    esi = engine.get("eventSequenceIntegrity") or {"kind": "normal"}
    if esi.get("kind") == "irregular":
        codes = sorted({r["code"] for r in esi.get("reasons", [])})
        _push(
            out,
            {
                "code": "EVENT_SEQUENCE_IRREGULAR",
                "severity": "medium",
                "concernCategory": "capture_integrity",
                "message": f"Event capture order or timestamps were irregular ({','.join(codes)}).",
                "evidence": {"scope": "event_sequence", "codes": codes},
            },
        )

    for r in ctx.get("retrievalEvents", []):
        if r.get("status") == "empty":
            _push(
                out,
                {
                    "code": "RETRIEVAL_EMPTY",
                    "severity": "high",
                    "concernCategory": "context_quality",
                    "message": f"Retrieval from \"{r.get('source')}\" returned empty.",
                    "evidence": {
                        "scope": "run_context",
                        "ingestIndex": r.get("ingestIndex"),
                        "source": r.get("source"),
                        "runEventId": r.get("runEventId"),
                        "codes": ["RETRIEVAL_EMPTY"],
                    },
                },
            )
        elif r.get("status") == "error":
            _push(
                out,
                {
                    "code": "RETRIEVAL_ERROR",
                    "severity": "high",
                    "concernCategory": "context_quality",
                    "message": f"Retrieval from \"{r.get('source')}\" failed.",
                    "evidence": {
                        "scope": "run_context",
                        "ingestIndex": r.get("ingestIndex"),
                        "source": r.get("source"),
                        "runEventId": r.get("runEventId"),
                        "codes": ["RETRIEVAL_ERROR"],
                    },
                },
            )
        elif r.get("status") == "ok" and r.get("hitCount") == 0:
            _push(
                out,
                {
                    "code": "RETRIEVAL_THIN_HITS",
                    "severity": "medium",
                    "concernCategory": "context_quality",
                    "message": f"Retrieval from \"{r.get('source')}\" reported ok with hitCount 0.",
                    "evidence": {
                        "scope": "run_context",
                        "ingestIndex": r.get("ingestIndex"),
                        "source": r.get("source"),
                        "runEventId": r.get("runEventId"),
                        "codes": ["RETRIEVAL_THIN_HITS"],
                    },
                },
            )

    if (
        ctx.get("maxWireSchemaVersion") in (2, 3)
        and len(ctx.get("retrievalEvents", [])) == 0
        and ctx.get("firstToolObservedIngestIndex") is not None
    ):
        _push(
            out,
            {
                "code": "NO_RETRIEVAL_EVENTS",
                "severity": "low",
                "concernCategory": "context_quality",
                "message": "No retrieval events recorded before tool observations (coarse missing-context signal).",
                "evidence": {"scope": "run_context", "codes": ["NO_RETRIEVAL_EVENTS"]},
            },
        )

    for m in ctx.get("modelTurnEvents", []):
        if m.get("status") in ("error", "aborted", "incomplete"):
            st = str(m.get("status")).upper()
            _push(
                out,
                {
                    "code": "MODEL_TURN_ABNORMAL",
                    "severity": "high",
                    "concernCategory": "decision_execution",
                    "message": f"Model turn ended with status {m.get('status')}.",
                    "evidence": {
                        "scope": "run_context",
                        "ingestIndex": m.get("ingestIndex"),
                        "runEventId": m.get("runEventId"),
                        "codes": [f"MODEL_TURN_{st}"],
                    },
                },
            )

    for c in ctx.get("controlEvents", []):
        if c.get("controlKind") == "interrupt":
            _push(
                out,
                {
                    "code": "CONTROL_INTERRUPT",
                    "severity": "high",
                    "concernCategory": "decision_execution",
                    "message": "Control interrupt recorded in run graph.",
                    "evidence": {
                        "scope": "run_context",
                        "ingestIndex": c.get("ingestIndex"),
                        "runEventId": c.get("runEventId"),
                        "codes": ["CONTROL_INTERRUPT"],
                    },
                },
            )
        elif c.get("controlKind") in ("branch", "gate") and c.get("decision") == "skipped":
            ck = str(c.get("controlKind")).upper()
            _push(
                out,
                {
                    "code": "BRANCH_OR_GATE_SKIPPED",
                    "severity": "medium",
                    "concernCategory": "decision_execution",
                    "message": f"{c.get('controlKind')} path was skipped.",
                    "evidence": {
                        "scope": "run_context",
                        "ingestIndex": c.get("ingestIndex"),
                        "runEventId": c.get("runEventId"),
                        "codes": [f"CONTROL_{ck}_SKIPPED"],
                    },
                },
            )

    for s in ctx.get("toolSkippedEvents", []):
        _push(
            out,
            {
                "code": "TOOL_SKIPPED",
                "severity": "medium",
                "concernCategory": "tool_selection_execution",
                "message": f"Tool {s.get('toolId')} was skipped.",
                "evidence": {
                    "scope": "run_context",
                    "ingestIndex": s.get("ingestIndex"),
                    "toolId": s.get("toolId"),
                    "codes": ["TOOL_SKIPPED"],
                },
            },
        )

    for step in engine.get("steps", []):
        if step.get("status") == "incomplete_verification":
            rs = step.get("reasons") or []
            primary = rs[0]["code"] if rs else None
            if primary is not None and primary in ACTION_INPUT_REASON_CODES:
                _push(
                    out,
                    {
                        "code": "ACTION_INPUT_RESOLUTION_FAILED",
                        "severity": "high",
                        "concernCategory": "action_inputs_invalid",
                        "message": (
                            f"Tool {step.get('toolId')} at seq {step.get('seq')}: "
                            f"parameter/registry resolution failed ({primary})."
                        ),
                        "evidence": {
                            "scope": "step",
                            "seq": step.get("seq"),
                            "toolId": step.get("toolId"),
                            "codes": [primary],
                        },
                    },
                )
            elif primary == SQL_VERIFICATION_OUTCOME_CODE["RETRY_OBSERVATIONS_DIVERGE"]:
                _push(
                    out,
                    {
                        "code": "RETRY_OBSERVATIONS_DIVERGE",
                        "severity": "medium",
                        "concernCategory": "workflow_completeness",
                        "message": f"Seq {step.get('seq')} tool {step.get('toolId')}: repeated observations diverged.",
                        "evidence": {
                            "scope": "step",
                            "seq": step.get("seq"),
                            "toolId": step.get("toolId"),
                            "codes": [primary],
                        },
                    },
                )
        if (step.get("repeatObservationCount") or 0) > 1:
            _push(
                out,
                {
                    "code": "LOGICAL_STEP_RETRIES",
                    "severity": "low",
                    "concernCategory": "workflow_completeness",
                    "message": (
                        f"Seq {step.get('seq')} tool {step.get('toolId')}: "
                        f"{step.get('repeatObservationCount')} observations for one logical step."
                    ),
                    "evidence": {
                        "scope": "step",
                        "seq": step.get("seq"),
                        "toolId": step.get("toolId"),
                        "codes": ["LOGICAL_STEP_RETRIES"],
                    },
                },
            )

    if (
        ctx.get("maxWireSchemaVersion") in (2, 3)
        and ctx.get("firstToolObservedIngestIndex") is not None
        and not ctx.get("hasRunCompletedControl")
    ):
        _push(
            out,
            {
                "code": "MISSING_RUN_COMPLETED",
                "severity": "medium",
                "concernCategory": "workflow_completeness",
                "message": "No run_completed control event after tool observations (v2 graph).",
                "evidence": {"scope": "run_context", "codes": ["MISSING_RUN_COMPLETED"]},
            },
        )

    last = ctx.get("lastRunEvent")
    if last is not None and last.get("type") == "model_turn":
        mts = last.get("modelTurnStatus")
        if mts is not None and mts != "completed":
            st = str(mts).upper()
            _push(
                out,
                {
                    "code": "LAST_EVENT_MODEL_ABNORMAL",
                    "severity": "high",
                    "concernCategory": "workflow_completeness",
                    "message": f"Last captured event is model_turn with status {mts}.",
                    "evidence": {
                        "scope": "run_context",
                        "ingestIndex": last.get("ingestIndex"),
                        "codes": [f"MODEL_TURN_{st}"],
                    },
                },
            )

    deduped = _dedupe_findings(out)
    for f in deduped:
        if f["code"] not in EXECUTION_PATH_FINDING_CODES:
            raise RuntimeError(f"Internal error: unknown execution path finding code {f['code']}")
        if f["code"] in RECONCILER_STEP_REASON_CODES and f["code"] not in RECONCILER_CODE_OK_AS_PATH_FINDING_CODE:
            raise RuntimeError(f"Internal error: reconciler code leaked into path finding: {f['code']}")
    return deduped


SUMMARY_V1_NO_CONCERNS = (
    "Full upstream execution-path visibility requires schemaVersion 2 run events "
    "(retrieval, model_turn, control, tool_skipped) with run graph fields."
)
SUMMARY_V2_CLEAR = "No execution-path concerns detected under current rules."


def build_execution_path_summary(findings: list[dict[str, Any]], max_wire_schema_version: int) -> str:
    if len(findings) == 0:
        return SUMMARY_V1_NO_CONCERNS if max_wire_schema_version == 1 else SUMMARY_V2_CLEAR
    codes = sorted({f["code"] for f in findings})
    return f"execution_path_concerns={len(findings)}; codes={','.join(codes)}"
