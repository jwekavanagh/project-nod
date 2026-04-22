from __future__ import annotations

from typing import Any, Literal, TypedDict

from agentskeptic.kernel.plan_logical import ToolObservedEvent, stable_sort_events_by_seq


class Reason(TypedDict, total=False):
    code: str
    message: str
    field: str


class EventSequenceNormal(TypedDict):
    kind: Literal["normal"]


class EventSequenceIrregular(TypedDict):
    kind: Literal["irregular"]
    reasons: list[Reason]


EventSequenceIntegrity = EventSequenceNormal | EventSequenceIrregular


def _parse_timestamp_ms(ts: str | None) -> float | None:
    if ts is None:
        return None
    # ISO-like; match Date.parse loosely
    from datetime import datetime

    try:
        d = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return d.timestamp() * 1000
    except ValueError:
        return None


def analyze_event_sequence_integrity(capture_order: list[ToolObservedEvent]) -> EventSequenceIntegrity:
    if len(capture_order) == 0:
        return {"kind": "normal"}

    reasons: list[Reason] = []
    max_seq_seen = float("-inf")
    capture_irregular = False
    for ev in capture_order:
        if ev["seq"] < max_seq_seen:
            capture_irregular = True
        max_seq_seen = max(max_seq_seen, ev["seq"])
    if capture_irregular:
        reasons.append(
            {
                "code": "CAPTURE_ORDER_NOT_MONOTONIC_IN_SEQ",
                "message": (
                    "Capture order was not non-decreasing in seq; planning and verification used "
                    "seq-sorted order, not arrival order."
                ),
            }
        )

    sorted_evs = stable_sort_events_by_seq(capture_order)
    for i in range(len(sorted_evs) - 1):
        a = sorted_evs[i]
        b = sorted_evs[i + 1]
        ta = _parse_timestamp_ms(a.get("timestamp"))
        tb = _parse_timestamp_ms(b.get("timestamp"))
        if ta is None or tb is None:
            continue
        if ta > tb:
            reasons.append(
                {
                    "code": "TIMESTAMP_NOT_MONOTONIC_WITH_SEQ_SORT_ORDER",
                    "message": (
                        f"In seq-sorted order, timestamp decreased between seq {a['seq']} and seq {b['seq']}."
                    ),
                }
            )
            break

    if not reasons:
        return {"kind": "normal"}
    return {"kind": "irregular", "reasons": reasons}
