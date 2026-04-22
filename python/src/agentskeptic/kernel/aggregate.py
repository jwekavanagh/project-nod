from __future__ import annotations

from typing import Any, Literal

from agentskeptic.kernel.verification_diagnostics import enrich_steps_with_failure_diagnostics


def aggregate_workflow(
    workflow_id: str,
    steps: list[dict[str, Any]],
    run_level_reasons_incoming: list[dict[str, Any]],
    verification_policy: dict[str, Any],
    event_sequence_integrity: dict[str, Any],
) -> dict[str, Any]:
    run_level_reasons = list(run_level_reasons_incoming)
    if len(steps) == 0:
        run_level_reasons.append({"code": "NO_STEPS_FOR_WORKFLOW", "message": "No tool_observed events for this workflow id after filtering."})

    has_incomplete = any(s.get("status") == "incomplete_verification" for s in steps)
    has_bad = any(
        s.get("status") in ("missing", "inconsistent", "partially_verified") for s in steps
    )

    if len(run_level_reasons) > 0 or len(steps) == 0 or has_incomplete:
        status: Literal["complete", "incomplete", "inconsistent"] = "incomplete"
    elif has_bad:
        status = "inconsistent"
    elif all(s.get("status") == "verified" for s in steps) and len(steps) > 0:
        status = "complete"
    else:
        status = "incomplete"

    enriched_steps = enrich_steps_with_failure_diagnostics(steps)

    return {
        "schemaVersion": 8,
        "workflowId": workflow_id,
        "status": status,
        "runLevelReasons": run_level_reasons,
        "verificationPolicy": verification_policy,
        "eventSequenceIntegrity": event_sequence_integrity,
        "steps": enriched_steps,
    }
