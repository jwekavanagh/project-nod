from __future__ import annotations

from typing import Any, Literal, TypedDict


class VerificationRunContext(TypedDict, total=False):
    maxWireSchemaVersion: Literal[1, 2, 3]
    retrievalEvents: list[dict[str, Any]]
    controlEvents: list[dict[str, Any]]
    modelTurnEvents: list[dict[str, Any]]
    toolSkippedEvents: list[dict[str, Any]]
    toolObservedIngestIndexBySeq: dict[str, int]
    firstToolObservedIngestIndex: int | None
    hasRunCompletedControl: bool
    lastRunEvent: dict[str, Any] | None


def create_empty_verification_run_context() -> VerificationRunContext:
    return {
        "maxWireSchemaVersion": 1,
        "retrievalEvents": [],
        "controlEvents": [],
        "modelTurnEvents": [],
        "toolSkippedEvents": [],
        "toolObservedIngestIndexBySeq": {},
        "firstToolObservedIngestIndex": None,
        "hasRunCompletedControl": False,
        "lastRunEvent": None,
    }


def _last_event_summary(run_events: list[dict[str, Any]]) -> dict[str, Any] | None:
    if len(run_events) == 0:
        return None
    last = run_events[-1]
    ingest_index = len(run_events) - 1
    if last.get("type") == "model_turn" and last.get("schemaVersion") == 2:
        return {"ingestIndex": ingest_index, "type": last["type"], "modelTurnStatus": last.get("status")}
    return {"ingestIndex": ingest_index, "type": last.get("type")}


def build_verification_run_context(run_events: list[dict[str, Any]]) -> VerificationRunContext:
    max_wire: Literal[1, 2, 3] = 1
    retrieval_events: list[dict[str, Any]] = []
    control_events: list[dict[str, Any]] = []
    model_turn_events: list[dict[str, Any]] = []
    tool_skipped_events: list[dict[str, Any]] = []
    tool_observed_ingest_index_by_seq: dict[str, int] = {}
    first_tool_observed_ingest_index: int | None = None
    has_run_completed_control = False

    for ingest_index, ev in enumerate(run_events):
        sv = ev.get("schemaVersion")
        if sv == 2:
            max_wire = 2
        if sv == 3:
            max_wire = 3

        if ev.get("type") == "retrieval" and ev.get("schemaVersion") == 2:
            row: dict[str, Any] = {
                "ingestIndex": ingest_index,
                "runEventId": ev.get("runEventId"),
                "source": ev.get("source"),
                "status": ev.get("status"),
            }
            if ev.get("hitCount") is not None:
                row["hitCount"] = ev["hitCount"]
            retrieval_events.append(row)
        elif ev.get("type") == "control" and ev.get("schemaVersion") == 2:
            if ev.get("controlKind") == "run_completed":
                has_run_completed_control = True
            ce: dict[str, Any] = {
                "ingestIndex": ingest_index,
                "runEventId": ev.get("runEventId"),
                "controlKind": ev.get("controlKind"),
            }
            if ev.get("decision") is not None:
                ce["decision"] = ev["decision"]
            if ev.get("label") is not None:
                ce["label"] = ev["label"]
            control_events.append(ce)
        elif ev.get("type") == "model_turn" and ev.get("schemaVersion") == 2:
            model_turn_events.append(
                {"ingestIndex": ingest_index, "runEventId": ev.get("runEventId"), "status": ev.get("status")}
            )
        elif ev.get("type") == "tool_skipped" and ev.get("schemaVersion") == 2:
            tool_skipped_events.append(
                {"ingestIndex": ingest_index, "toolId": ev.get("toolId"), "reason": ev.get("reason")}
            )
        elif ev.get("type") == "tool_observed":
            tool_observed_ingest_index_by_seq[str(ev["seq"])] = ingest_index
            if first_tool_observed_ingest_index is None or ingest_index < first_tool_observed_ingest_index:
                first_tool_observed_ingest_index = ingest_index

    return {
        "maxWireSchemaVersion": max_wire,
        "retrievalEvents": retrieval_events,
        "controlEvents": control_events,
        "modelTurnEvents": model_turn_events,
        "toolSkippedEvents": tool_skipped_events,
        "toolObservedIngestIndexBySeq": tool_observed_ingest_index_by_seq,
        "firstToolObservedIngestIndex": first_tool_observed_ingest_index,
        "hasRunCompletedControl": has_run_completed_control,
        "lastRunEvent": _last_event_summary(run_events),
    }
