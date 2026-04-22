from __future__ import annotations

from typing import Any, TypedDict

from agentskeptic.kernel.support_core import canonical_json_for_params


class ToolObservedEvent(TypedDict, total=False):
    schemaVersion: int
    workflowId: str
    seq: int
    type: str
    toolId: str
    params: dict[str, Any]
    timestamp: str
    runEventId: str
    parentRunEventId: str
    langgraphCheckpoint: dict[str, str]


def stable_sort_events_by_seq(events: list[ToolObservedEvent]) -> list[ToolObservedEvent]:
    return sorted(events, key=lambda e: e["seq"])


def observations_match_for_divergence(a: ToolObservedEvent, b: ToolObservedEvent) -> bool:
    return a["toolId"] == b["toolId"] and canonical_json_for_params(a["params"]) == canonical_json_for_params(
        b["params"]
    )


class LogicalStepPlan(TypedDict):
    seq: int
    observations: list[ToolObservedEvent]
    last: ToolObservedEvent
    repeatObservationCount: int
    divergent: bool


def plan_logical_steps(events: list[ToolObservedEvent]) -> list[LogicalStepPlan]:
    sorted_evs = stable_sort_events_by_seq(events)
    by_seq: dict[int, list[ToolObservedEvent]] = {}
    for ev in sorted_evs:
        by_seq.setdefault(ev["seq"], []).append(ev)
    seqs = sorted(by_seq.keys())
    out: list[LogicalStepPlan] = []
    for seq in seqs:
        observations = by_seq[seq]
        last = observations[-1]
        divergent = False
        if len(observations) >= 2:
            for i in range(len(observations) - 1):
                if not observations_match_for_divergence(observations[i], last):
                    divergent = True
                    break
        out.append(
            {
                "seq": seq,
                "observations": observations,
                "last": last,
                "repeatObservationCount": len(observations),
                "divergent": divergent,
            }
        )
    return out
