from __future__ import annotations

from typing import Any


def format_no_steps_for_workflow_message(workflow_id: str, c: dict[str, int]) -> str:
    return (
        f"No tool_observed events for workflowId {repr(workflow_id)} after filtering. "
        f"event_file_non_empty_lines={c['eventFileNonEmptyLines']} schema_valid_events={c['schemaValidEvents']} "
        f"tool_observed_for_workflow={c['toolObservedForRequestedWorkflowId']} "
        f"tool_observed_other_workflows={c['toolObservedForOtherWorkflowIds']}."
    )


def enrich_no_steps_run_level_reasons(
    workflow_id: str, reasons: list[dict[str, Any]], c: dict[str, int]
) -> None:
    msg = format_no_steps_for_workflow_message(workflow_id, c)
    for r in reasons:
        if r.get("code") == "NO_STEPS_FOR_WORKFLOW":
            r["message"] = msg
