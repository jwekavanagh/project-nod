from __future__ import annotations

from typing import Any, Literal

LANGGRAPH_CHECKPOINT_TRUST_INELIGIBLE_HEADLINE = "LangGraph checkpoint trust: ineligible"


def workflow_result_to_state_relation(result: dict[str, Any]) -> Literal["matches_expectations", "does_not_match", "not_established"]:
    st = result.get("status")
    if st == "complete":
        return "matches_expectations"
    if st == "inconsistent":
        return "does_not_match"
    return "not_established"


def derive_high_stakes_reliance(
    run_kind: str, state_relation: str
) -> Literal["permitted", "prohibited"]:
    if run_kind == "quick_preview":
        return "prohibited"
    if state_relation == "matches_expectations":
        return "permitted"
    return "prohibited"


def _build_reliance_rationale(run_kind: str, state_relation: str, high_stakes: str) -> str:
    if run_kind == "contract_sql_langgraph_checkpoint_trust":
        if high_stakes == "permitted":
            return (
                "Contract verification used your registry and read-only SQL; every captured step matched "
                "declared expectations under the configured rules, and every LangGraph checkpoint rollup verdict "
                "is verified. You may treat this artifact as decision-grade for those steps, subject to your own "
                "scope and retention policy."
            )
        if state_relation == "does_not_match":
            return (
                "At least one step failed verification against the database (missing row, wrong values, or "
                "partial multi-effect failure), or a LangGraph checkpoint rollup verdict is inconsistent. "
                "Do not treat this run as meeting its intended persisted outcome."
            )
        return (
            "LangGraph checkpoint trust mode did not establish a single approved production snapshot (ineligible "
            "wire, incomplete verification, incomplete checkpoint rollup, or sequence integrity). "
            "Do not treat absence of a mismatch as proof of success."
        )
    if run_kind == "contract_sql":
        if high_stakes == "permitted":
            return (
                "Contract verification used your registry and read-only SQL; every captured step matched "
                "declared expectations under the configured rules. You may treat this artifact as decision-grade "
                "for those steps, subject to your own scope and retention policy."
            )
        if state_relation == "does_not_match":
            return (
                "At least one step failed verification against the database (missing row, wrong values, or "
                "partial multi-effect failure). Do not treat this run as meeting its intended persisted outcome."
            )
        return (
            "Verification could not be completed or could not establish a determinate match (incomplete registry, "
            "empty capture, indeterminate window, or connector issue). Do not treat absence of a mismatch as proof "
            "of success."
        )
    return ""


def _truth_step_to_certificate_step(step: dict[str, Any]) -> dict[str, Any]:
    narrative = step["intendedEffect"]["narrative"]
    vt = step.get("verifyTarget")
    expected_outcome = narrative if vt is None else vt
    return {
        "seq": step["seq"],
        "toolId": step.get("toolId"),
        "declaredAction": narrative,
        "expectedOutcome": expected_outcome,
        "observedOutcome": step["observedStateSummary"],
    }


def _build_explanation_from_workflow_result(result: dict[str, Any]) -> dict[str, Any]:
    truth = result["workflowTruthReport"]
    details: list[dict[str, str]] = []
    for step in truth["steps"]:
        for r in step.get("reasons", []):
            details.append({"code": r["code"], "message": r["message"]})
    for r in result.get("runLevelReasons", []):
        details.append({"code": r["code"], "message": r["message"]})
    fe = truth.get("failureExplanation")
    fa = truth.get("failureAnalysis")
    if fa is not None:
        headline = fa["summary"]
    elif fe is not None:
        headline = f"{fe['divergence']} — expected: {fe['expected']}; observed: {fe['observed']}"
    else:
        headline = truth["trustSummary"]
    return {"headline": headline, "details": details}


def _rollup_checkpoint_group_verdict(outcomes: list[dict[str, Any]]) -> str:
    if any(o.get("status") == "incomplete_verification" for o in outcomes):
        return "incomplete"
    if any(o.get("status") in ("missing", "inconsistent", "partially_verified") for o in outcomes):
        return "inconsistent"
    if all(o.get("status") == "verified" for o in outcomes):
        return "verified"
    return "incomplete"


def _checkpoint_production_meaning(verdict: str) -> str:
    if verdict == "verified":
        return "Production may advance under this checkpoint identity."
    if verdict == "inconsistent":
        return "Do not advance production for this checkpoint identity until traces and database agree."
    return "Verification is incomplete for this checkpoint identity; production gate remains closed."


def compute_checkpoint_verdicts_from_workflow_result(result: dict[str, Any]) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for s in result.get("steps", []):
        key = s.get("langgraphCheckpointKey")
        if key is None:
            continue
        g = by_key.setdefault(key, {"seqs": [], "outcomes": []})
        g["seqs"].append(s["seq"])
        g["outcomes"].append(s)
    keys = sorted(
        by_key.keys(),
        key=lambda k: (min(by_key[k]["seqs"]), k),
    )
    out: list[dict[str, Any]] = []
    for key in keys:
        g = by_key[key]
        seqs_sorted = sorted(set(g["seqs"]))
        verdict = _rollup_checkpoint_group_verdict(g["outcomes"])
        out.append(
            {
                "checkpointKey": key,
                "verdict": verdict,
                "seqs": seqs_sorted,
                "productionMeaning": _checkpoint_production_meaning(verdict),
            }
        )
    return out


def build_outcome_certificate_from_workflow_result(result: dict[str, Any], run_kind: str) -> dict[str, Any]:
    state_relation = workflow_result_to_state_relation(result)
    high_stakes = derive_high_stakes_reliance(run_kind, state_relation)
    truth = result["workflowTruthReport"]
    steps = [_truth_step_to_certificate_step(s) for s in truth["steps"]]
    from agentskeptic.kernel.workflow_truth_report import format_workflow_truth_report_struct

    human_report = format_workflow_truth_report_struct(truth)
    return {
        "schemaVersion": 1,
        "workflowId": result["workflowId"],
        "runKind": run_kind,
        "stateRelation": state_relation,
        "highStakesReliance": high_stakes,
        "relianceRationale": _build_reliance_rationale(run_kind, state_relation, high_stakes),
        "intentSummary": truth["trustSummary"],
        "explanation": _build_explanation_from_workflow_result(result),
        "steps": steps,
        "humanReport": human_report,
    }


def build_outcome_certificate_langgraph_checkpoint_trust_from_workflow_result(result: dict[str, Any]) -> dict[str, Any]:
    run_kind = "contract_sql_langgraph_checkpoint_trust"
    state_relation = workflow_result_to_state_relation(result)
    high_stakes = derive_high_stakes_reliance(run_kind, state_relation)
    truth = result["workflowTruthReport"]
    steps = [_truth_step_to_certificate_step(s) for s in truth["steps"]]
    checkpoint_verdicts = compute_checkpoint_verdicts_from_workflow_result(result)
    from agentskeptic.kernel.workflow_truth_report import format_workflow_truth_report_struct

    base_human = format_workflow_truth_report_struct(truth)
    if len(checkpoint_verdicts) == 0:
        human_report = base_human
    else:
        sep = "\u001f"
        lines = [base_human, "", "langgraph_checkpoint_verdicts:"]
        for c in checkpoint_verdicts:
            lines.append(f"{c['checkpointKey']}\t{c['verdict']}\t{c['productionMeaning']}")
        human_report = "\n".join(lines)
    cert = {
        "schemaVersion": 1,
        "workflowId": result["workflowId"],
        "runKind": run_kind,
        "stateRelation": state_relation,
        "highStakesReliance": high_stakes,
        "relianceRationale": _build_reliance_rationale(run_kind, state_relation, high_stakes),
        "intentSummary": truth["trustSummary"],
        "explanation": _build_explanation_from_workflow_result(result),
        "steps": steps,
        "humanReport": human_report,
        "checkpointVerdicts": checkpoint_verdicts,
    }
    return cert


def build_ineligible_langgraph_checkpoint_trust_certificate(
    workflow_id: str, run_level_reasons: list[dict[str, Any]]
) -> dict[str, Any]:
    run_kind = "contract_sql_langgraph_checkpoint_trust"
    state_relation = "not_established"
    high_stakes = derive_high_stakes_reliance(run_kind, state_relation)
    ineligible_headline = LANGGRAPH_CHECKPOINT_TRUST_INELIGIBLE_HEADLINE
    if len(run_level_reasons) > 0:
        details = [{"code": r["code"], "message": r["message"]} for r in run_level_reasons]
        human_report = ineligible_headline + "\n" + "\n".join(f"{r['code']}: {r['message']}" for r in run_level_reasons)
    else:
        details = [
            {
                "code": "LANGGRAPH_INELIGIBLE",
                "message": (
                    "No schema-valid schemaVersion 3 tool_observed lines for this workflow in LangGraph "
                    "checkpoint trust mode."
                ),
            }
        ]
        human_report = f"{ineligible_headline}\n{details[0]['code']}: {details[0]['message']}"
    return {
        "schemaVersion": 1,
        "workflowId": workflow_id,
        "runKind": run_kind,
        "stateRelation": state_relation,
        "highStakesReliance": high_stakes,
        "relianceRationale": _build_reliance_rationale(run_kind, state_relation, high_stakes),
        "intentSummary": ineligible_headline,
        "explanation": {"headline": ineligible_headline, "details": details},
        "steps": [],
        "humanReport": human_report,
    }
