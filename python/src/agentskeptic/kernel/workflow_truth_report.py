from __future__ import annotations

from typing import Any

from agentskeptic.kernel.reconciliation_presentation import (
    LINE_PREFIX_DECLARED,
    LINE_PREFIX_EXPECTED,
    LINE_PREFIX_OBSERVED_DATABASE,
    LINE_PREFIX_VERIFICATION_VERDICT,
    format_batch_declared_stderr_value,
    format_batch_expected_stderr_value,
    format_batch_observed_state_summary,
    format_batch_verification_verdict_stderr_value,
)
from agentskeptic.kernel.user_phrases import user_phrase_for_reason_code
from agentskeptic.kernel.verification_diagnostics import (
    STEP_STATUS_TRUTH_LABELS,
    format_verification_target_summary,
)

TRUST_LINE_BY_STATUS = {
    "complete": "TRUSTED: Every step matched the database under the configured verification rules.",
    "incomplete": "NOT TRUSTED: Verification is incomplete; the workflow cannot be fully confirmed.",
    "inconsistent": (
        "NOT TRUSTED: At least one step failed verification against the database (determinate failure)."
    ),
}

TRUST_LINE_EVENT_SEQUENCE_IRREGULAR_SUFFIX = (
    "Event capture or timestamps were irregular; verification used seq-sorted order. See event_sequence below."
)

HUMAN_REPORT_RESULT_PHRASE = {
    "VERIFIED": "Matched the database.",
    "FAILED_ROW_MISSING": (
        "Expected row is missing from the database (the log implies a write that is not present)."
    ),
    "FAILED_VALUE_MISMATCH": "A row was found, but required values do not match.",
    "INCOMPLETE_CANNOT_VERIFY": "This step could not be fully verified (registry, connector, or data shape issue).",
    "PARTIALLY_VERIFIED": "Some intended database effects matched; others did not.",
    "UNCERTAIN_NOT_OBSERVED_WITHIN_WINDOW": (
        "The expected row did not appear within the verification window."
    ),
}

HUMAN_REPORT_EFFECT_RESULT_PHRASE = dict(HUMAN_REPORT_RESULT_PHRASE)


def _sanitize_one_line_id(value: str) -> str:
    return value.replace("\r\n", "_").replace("\r", "_").replace("\n", "_")


def _single_line_intended(effect: str) -> str:
    return " ".join(effect.replace("\r", " ").replace("\n", " ").replace("\t", " ").split()).strip()


def _copy_reason(r: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"code": r["code"], "message": r["message"]}
    if r.get("field"):
        out["field"] = r["field"]
    return out


def _push_human_reason_lines(lines: list[str], r: dict[str, Any], indent: str) -> None:
    msg = str(r.get("message", "")).strip()
    human = msg if len(msg) > 0 else "(no message)"
    detail_line = f"{indent}detail: {human}"
    if r.get("field"):
        detail_line += f" field={r['field']}"
    lines.append(detail_line)
    lines.append(f"{indent}reference_code: {r['code']}")
    lines.append(f"{indent}user_meaning: {user_phrase_for_reason_code(r['code'])}")


def _trust_line_base_for_engine(engine: dict[str, Any]) -> str:
    if (
        engine.get("status") == "incomplete"
        and len(engine.get("runLevelReasons", [])) == 0
        and any(s.get("status") == "uncertain" for s in engine.get("steps", []))
        and not any(
            s.get("status") in ("missing", "inconsistent", "partially_verified", "incomplete_verification")
            for s in engine.get("steps", [])
        )
    ):
        return (
            "NOT TRUSTED: At least one step could not be confirmed within the verification window "
            "(row not observed; replication or processing delay is possible)."
        )
    return TRUST_LINE_BY_STATUS[engine["status"]]


def _trust_summary_for_engine(engine: dict[str, Any]) -> str:
    base = _trust_line_base_for_engine(engine)
    esi = engine.get("eventSequenceIntegrity") or {"kind": "normal"}
    if esi.get("kind") == "irregular":
        return f"{base} {TRUST_LINE_EVENT_SEQUENCE_IRREGULAR_SUFFIX}"
    return base


def _build_truth_step(s: dict[str, Any]) -> dict[str, Any]:
    label = STEP_STATUS_TRUTH_LABELS[s["status"]]
    vt = format_verification_target_summary(s.get("verificationRequest"))
    narrative = _single_line_intended(s["intendedEffect"]["narrative"])
    params_canonical = _single_line_intended(s["observedExecution"]["paramsCanonical"])
    base: dict[str, Any] = {
        "seq": s["seq"],
        "toolId": s["toolId"],
        "outcomeLabel": label,
        "observations": {
            "evaluatedOrdinal": s["evaluatedObservationOrdinal"],
            "repeatCount": s["repeatObservationCount"],
        },
        "reasons": [_copy_reason(r) for r in s.get("reasons", [])],
        "intendedEffect": {"narrative": narrative},
        "observedExecution": {"paramsCanonical": params_canonical},
        "verifyTarget": vt,
        "observedStateSummary": format_batch_observed_state_summary(s),
    }
    if s.get("status") != "verified":
        base["failureCategory"] = s.get("failureDiagnostic")
    else:
        base.pop("failureCategory", None)
    raw_effects = (s.get("evidenceSummary") or {}).get("effects")
    effects: list[dict[str, Any]] = []
    if isinstance(raw_effects, list):
        for row in raw_effects:
            if not isinstance(row, dict):
                continue
            if not isinstance(row.get("id"), str) or not isinstance(row.get("status"), str):
                continue
            effects.append(
                {
                    "id": _sanitize_one_line_id(row["id"]),
                    "outcomeLabel": {
                        "verified": "VERIFIED",
                        "missing": "FAILED_ROW_MISSING",
                        "inconsistent": "FAILED_VALUE_MISMATCH",
                        "incomplete_verification": "INCOMPLETE_CANNOT_VERIFY",
                    }[row["status"]],
                    "reasons": [_copy_reason(r) for r in row.get("reasons", []) if isinstance(r, dict)],
                }
            )
    if effects:
        base["effects"] = effects
    return base


def build_workflow_truth_report(engine: dict[str, Any]) -> dict[str, Any]:
    run_level_issues = (
        []
        if len(engine.get("runLevelReasons", [])) == 0
        else [
            {
                "code": r["code"],
                "message": r["message"],
                "category": "workflow_execution",
            }
            for r in engine["runLevelReasons"]
        ]
    )

    esi = engine.get("eventSequenceIntegrity") or {"kind": "normal"}
    if esi.get("kind") == "normal":
        event_sequence: dict[str, Any] = {"kind": "normal"}
    else:
        event_sequence = {
            "kind": "irregular",
            "issues": [
                {
                    "code": r["code"],
                    "message": r["message"],
                    "category": "workflow_execution",
                }
                for r in esi.get("reasons", [])
            ],
        }

    ctx = engine.get("verificationRunContext") or {}
    from agentskeptic.kernel.execution_path_findings import (
        build_execution_path_findings,
        build_execution_path_summary,
    )

    execution_path_findings = build_execution_path_findings(engine)
    execution_path_summary = build_execution_path_summary(
        execution_path_findings, int(ctx.get("maxWireSchemaVersion", 1))
    )

    steps = [_build_truth_step(s) for s in engine.get("steps", [])]

    failure_analysis = None
    failure_explanation = None
    correctness_definition = None

    return {
        "schemaVersion": 9,
        "workflowId": engine["workflowId"],
        "workflowStatus": engine["status"],
        "trustSummary": _trust_summary_for_engine(engine),
        "runLevelIssues": run_level_issues,
        "eventSequence": event_sequence,
        "steps": steps,
        "failureAnalysis": failure_analysis,
        "executionPathFindings": execution_path_findings,
        "executionPathSummary": execution_path_summary,
        "failureExplanation": failure_explanation,
        "correctnessDefinition": correctness_definition,
    }


def format_workflow_truth_report_struct(truth: dict[str, Any]) -> str:
    lines: list[str] = []

    def sol(s: str) -> str:
        return _sanitize_one_line_id(s)

    lines.append(f"workflow_id: {sol(truth['workflowId'])}")
    lines.append(f"workflow_status: {truth['workflowStatus']}")
    lines.append(f"trust: {truth['trustSummary']}")
    lines.append(f"execution_path: {truth['executionPathSummary']}")
    for pf in truth.get("executionPathFindings", []):
        parts = [
            f"code={sol(pf['code'])}",
            f"severity={pf['severity']}",
            f"concern={pf['concernCategory']}",
            f"scope={pf['evidence']['scope']}",
        ]
        ev = pf["evidence"]
        if ev.get("codes") is not None:
            parts.append(f"codes={','.join(ev['codes'])}")
        if ev.get("ingestIndex") is not None:
            parts.append(f"ingest_index={ev['ingestIndex']}")
        if ev.get("seq") is not None:
            parts.append(f"seq={ev['seq']}")
        if ev.get("toolId") is not None:
            parts.append(f"tool={sol(ev['toolId'])}")
        if ev.get("source") is not None:
            parts.append(f"source={sol(ev['source'])}")
        lines.append(f"  - path_finding: {' '.join(parts)}")
        lines.append(f"    detail: {str(pf['message']).replace(chr(10), ' ').replace(chr(13), ' ').strip()}")

    if truth.get("failureAnalysis") is not None:
        d = truth["failureAnalysis"]
        lines.append("diagnosis:")
        lines.append(f"  summary: {d['summary']}")
        lines.append(f"  primary_origin: {d['primaryOrigin']}")
        lines.append(f"  confidence: {d['confidence']}")
        af = d["actionableFailure"]
        lines.append(
            "  actionable_failure: "
            f"category={af['category']} severity={af['severity']} "
            f"recommended_action={af['recommendedAction']} automation_safe={af['automationSafe']}"
        )
        for ev in d.get("evidence", []):
            parts = [f"scope={ev['scope']}"]
            if ev.get("codes") is not None:
                parts.append(f"codes={','.join(ev['codes'])}")
            lines.append(f"  - evidence: {' '.join(parts)}")

    if truth.get("failureExplanation") is not None:
        fe = truth["failureExplanation"]
        lines.append("failure_explanation:")
        lines.append(f"expected: {fe['expected']}")
        lines.append(f"observed: {fe['observed']}")
        lines.append(f"divergence: {fe['divergence']}")

    if truth.get("correctnessDefinition") is not None:
        cd = truth["correctnessDefinition"]
        lines.append("correctness_definition:")
        lines.append(f"  enforcement_kind: {cd['enforcementKind']}")

    if len(truth.get("runLevelIssues", [])) == 0:
        lines.append("run_level: (none)")
    else:
        lines.append("run_level:")
        for r in truth["runLevelIssues"]:
            msg = str(r["message"]).strip()
            human = msg if len(msg) > 0 else "(no message)"
            lines.append(f"  - detail: {human}")
            lines.append(f"    category: {r['category']}")
            lines.append(f"    reference_code: {r['code']}")
            lines.append(f"    user_meaning: {user_phrase_for_reason_code(r['code'])}")

    es = truth["eventSequence"]
    if es["kind"] == "normal":
        lines.append("event_sequence: normal")
    else:
        lines.append("event_sequence: irregular")
        for r in es.get("issues", []):
            msg = str(r["message"]).strip()
            human = msg if len(msg) > 0 else "(no message)"
            lines.append(f"  - detail: {human}")
            lines.append(f"    category: {r['category']}")
            lines.append(f"    reference_code: {r['code']}")
            lines.append(f"    user_meaning: {user_phrase_for_reason_code(r['code'])}")

    step_phrase_map = HUMAN_REPORT_RESULT_PHRASE
    lines.append("steps:")
    for s in truth["steps"]:
        tool_id = sol(s["toolId"])
        result_phrase = step_phrase_map[s["outcomeLabel"]]
        lines.append(f"  - seq={s['seq']} tool={tool_id}")
        lines.append(
            f"    {LINE_PREFIX_DECLARED}"
            + format_batch_declared_stderr_value(
                tool_id, s["intendedEffect"]["narrative"], s["observedExecution"]["paramsCanonical"]
            )
        )
        lines.append(f"    {LINE_PREFIX_EXPECTED}{format_batch_expected_stderr_value(s.get('verifyTarget'))}")
        lines.append(f"    {LINE_PREFIX_OBSERVED_DATABASE}{s['observedStateSummary']}")
        lines.append(
            f"    {LINE_PREFIX_VERIFICATION_VERDICT}"
            + format_batch_verification_verdict_stderr_value(
                s["outcomeLabel"],
                result_phrase,
                None if s["outcomeLabel"] == "VERIFIED" else s.get("failureCategory"),
            )
        )
        lines.append(
            "    observations: "
            f"evaluated={s['observations']['evaluatedOrdinal']} of {s['observations']['repeatCount']} "
            "in_capture_order"
        )
        for r in s.get("reasons", []):
            _push_human_reason_lines(lines, r, "    ")
        if "effects" in s:
            for eff in s["effects"]:
                eid = sol(eff["id"])
                eff_phrase = HUMAN_REPORT_EFFECT_RESULT_PHRASE[eff["outcomeLabel"]]
                lines.append(f"    effect: id={eid} result={eff_phrase}")
                for r in eff.get("reasons", []):
                    _push_human_reason_lines(lines, r, "      ")

    return "\n".join(lines)


def finalize_emitted_workflow_result(engine: dict[str, Any]) -> dict[str, Any]:
    truth = build_workflow_truth_report(engine)
    out = dict(engine)
    out["schemaVersion"] = 15
    out["workflowTruthReport"] = truth
    return out
