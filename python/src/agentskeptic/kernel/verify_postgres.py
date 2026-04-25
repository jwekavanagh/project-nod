from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TYPE_CHECKING, cast

import jsonschema
if TYPE_CHECKING:
    import psycopg

from agentskeptic.kernel.aggregate import aggregate_workflow
from agentskeptic.kernel.event_sequence import analyze_event_sequence_integrity
from agentskeptic.kernel.no_steps import enrich_no_steps_run_level_reasons
from agentskeptic.kernel.reconciler_postgres import reconcile_sql_row_postgres
from agentskeptic.kernel.resolve_expectation import (
    UNKNOWN_TOOL,
    ResolveOkSqlRow,
    build_registry_map,
    render_intended_effect,
    resolve_verification_request,
)
from agentskeptic.kernel.verification_diagnostics import with_failure_diagnostic
from agentskeptic.kernel.verification_run_context import build_verification_run_context
from agentskeptic.kernel.plan_logical import ToolObservedEvent, plan_logical_steps
from agentskeptic.kernel.verify_sqlite import (
    _build_divergent_step_outcome,
    _default_verification_policy,
    _intended_effect_narrative,
    _observed_execution_from_params,
    _with_optional_langgraph_key,
    classify_lang_graph_checkpoint_trust_eligibility,
)
from agentskeptic.kernel.workflow_truth_report import finalize_emitted_workflow_result
from agentskeptic.kernel.outcome_certificate import (
    build_ineligible_langgraph_checkpoint_trust_certificate,
    build_outcome_certificate_langgraph_checkpoint_trust_from_workflow_result,
)


def _verify_tool_observed_step_postgres(
    *,
    workflow_id: str,
    ev: ToolObservedEvent,
    registry: dict[str, dict[str, Any]],
    conn: "psycopg.Connection",
    verification_policy: dict[str, Any],
    repeat_observation_count: int = 1,
) -> dict[str, Any]:
    _ = conn, workflow_id, verification_policy
    evaluated_observation_ordinal = repeat_observation_count
    entry = registry.get(ev["toolId"])
    if entry is None:
        outcome: dict[str, Any] = {
            "seq": ev["seq"],
            "toolId": ev["toolId"],
            "intendedEffect": _intended_effect_narrative(None, ev["toolId"], ev["params"]),
            "observedExecution": _observed_execution_from_params(ev["params"]),
            "verificationRequest": None,
            "status": "incomplete_verification",
            "reasons": [{"code": UNKNOWN_TOOL, "message": f"Unknown toolId: {ev['toolId']}"}],
            "evidenceSummary": {},
            "repeatObservationCount": repeat_observation_count,
            "evaluatedObservationOrdinal": evaluated_observation_ordinal,
        }
        return with_failure_diagnostic(_with_optional_langgraph_key(outcome, ev))

    intended = _intended_effect_narrative(entry, ev["toolId"], ev["params"])
    observed = _observed_execution_from_params(ev["params"])
    resolved = resolve_verification_request(entry, ev["params"])
    if not resolved["ok"]:
        outcome = {
            "seq": ev["seq"],
            "toolId": ev["toolId"],
            "intendedEffect": intended,
            "observedExecution": observed,
            "verificationRequest": None,
            "status": "incomplete_verification",
            "reasons": [{"code": resolved["code"], "message": resolved["message"]}],
            "evidenceSummary": {},
            "repeatObservationCount": repeat_observation_count,
            "evaluatedObservationOrdinal": evaluated_observation_ordinal,
        }
        return with_failure_diagnostic(_with_optional_langgraph_key(outcome, ev))

    assert resolved["ok"] is True
    res_ok: ResolveOkSqlRow = cast(ResolveOkSqlRow, resolved)
    req = res_ok["request"]
    exec_rec = reconcile_sql_row_postgres(conn, req)
    outcome = {
        "seq": ev["seq"],
        "toolId": ev["toolId"],
        "intendedEffect": intended,
        "observedExecution": observed,
        "verificationRequest": req,
        "status": exec_rec["status"],
        "reasons": exec_rec["reasons"],
        "evidenceSummary": exec_rec["evidenceSummary"],
        "repeatObservationCount": repeat_observation_count,
        "evaluatedObservationOrdinal": evaluated_observation_ordinal,
    }
    return with_failure_diagnostic(_with_optional_langgraph_key(outcome, ev))


def _run_logical_steps_verification_postgres(
    *,
    workflow_id: str,
    events: list[ToolObservedEvent],
    registry: dict[str, dict[str, Any]],
    conn: "psycopg.Connection",
    verification_policy: dict[str, Any],
) -> list[dict[str, Any]]:
    plans = plan_logical_steps(events)
    out: list[dict[str, Any]] = []
    for plan in plans:
        n = plan["repeatObservationCount"]
        if plan["divergent"]:
            out.append(_build_divergent_step_outcome(plan, registry))
            continue
        out.append(
            _verify_tool_observed_step_postgres(
                workflow_id=workflow_id,
                ev=plan["last"],
                registry=registry,
                conn=conn,
                verification_policy=verification_policy,
                repeat_observation_count=n,
            )
        )
    return out


def verify_run_state_from_buffered_events_postgres(
    *,
    workflow_id: str,
    registry_path: str | Path,
    database_url: str,
    buffered_run_events: list[dict[str, Any]],
    run_level_reasons: list[dict[str, Any]],
    project_root: str | Path | None = None,
) -> dict[str, Any]:
    try:
        import psycopg  # type: ignore[import-untyped]
    except ImportError as e:  # pragma: no cover
        raise ImportError("PostgreSQL support requires: pip install 'agentskeptic[postgres]'") from e

    _ = project_root
    reg_path = Path(registry_path)
    raw = json.loads(reg_path.read_text(encoding="utf8"))
    from agentskeptic.kernel.support_core import tools_registry_schema_path

    schema_path = tools_registry_schema_path()
    schema = json.loads(schema_path.read_text(encoding="utf8"))
    jsonschema.validate(instance=raw, schema=schema)
    entries = raw if isinstance(raw, list) else []
    registry = build_registry_map(entries)

    tool_candidates: list[ToolObservedEvent] = []
    for ev in buffered_run_events:
        if isinstance(ev, dict) and ev.get("type") == "tool_observed":
            tool_candidates.append(ev)  # type: ignore[arg-type]

    prep = analyze_event_sequence_integrity(tool_candidates)
    event_sequence_integrity = prep

    counts = {
        "eventFileNonEmptyLines": 0,
        "schemaValidEvents": 0,
        "toolObservedForRequestedWorkflowId": 0,
        "toolObservedForOtherWorkflowIds": 0,
    }

    with psycopg.connect(database_url) as conn:
        steps = _run_logical_steps_verification_postgres(
            workflow_id=workflow_id,
            events=tool_candidates,
            registry=registry,
            conn=conn,
            verification_policy=_default_verification_policy(),
        )

    engine_base = aggregate_workflow(
        workflow_id,
        steps,
        list(run_level_reasons),
        _default_verification_policy(),
        event_sequence_integrity,
    )
    enrich_no_steps_run_level_reasons(workflow_id, engine_base["runLevelReasons"], counts)
    engine = {
        **engine_base,
        "verificationRunContext": build_verification_run_context(list(buffered_run_events)),
    }
    return finalize_emitted_workflow_result(engine)


def verify_langgraph_checkpoint_trust_postgres(
    *,
    workflow_id: str,
    registry_path: str | Path,
    database_url: str,
    buffered_run_events: list[dict[str, Any]],
    run_level_reasons: list[dict[str, Any]],
) -> dict[str, Any]:
    tools = [e for e in buffered_run_events if isinstance(e, dict) and e.get("type") == "tool_observed"]
    elig = classify_lang_graph_checkpoint_trust_eligibility(
        run_level_reasons=run_level_reasons, tool_observed_events=tools  # type: ignore[arg-type]
    )
    if not elig["eligible"]:
        return build_ineligible_langgraph_checkpoint_trust_certificate(
            workflow_id, elig.get("certificateReasons", [])
        )
    wf = verify_run_state_from_buffered_events_postgres(
        workflow_id=workflow_id,
        registry_path=registry_path,
        database_url=database_url,
        buffered_run_events=buffered_run_events,
        run_level_reasons=run_level_reasons,
    )
    return build_outcome_certificate_langgraph_checkpoint_trust_from_workflow_result(wf)
