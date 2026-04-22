from __future__ import annotations

SQL_VERIFICATION_PHRASES: dict[str, str] = {
    "ROW_ABSENT": "Success was implied, but no matching row was found in the database.",
    "DUPLICATE_ROWS": "Duplicate or conflicting rows matched the same key.",
    "ROW_SHAPE_MISMATCH": "The row’s shape or columns did not match what verification expected.",
    "UNREADABLE_VALUE": "A stored value could not be read or compared reliably.",
    "VALUE_MISMATCH": "Wrong value in the database for a required field.",
    "CONNECTOR_ERROR": "Database query failed during verification.",
    "UNKNOWN_TOOL": "The tool is not defined in the registry (or could not be resolved).",
    "RETRY_OBSERVATIONS_DIVERGE": "Multiple observations for this sequence do not agree.",
    "MALFORMED_EVENT_LINE": "Event line was missing, invalid JSON, or failed schema validation for a tool observation.",
    "CAPTURE_ORDER_NOT_MONOTONIC_IN_SEQ": (
        "Capture order was not non-decreasing in seq; planning and verification used seq-sorted order, not arrival order."
    ),
    "TIMESTAMP_NOT_MONOTONIC_WITH_SEQ_SORT_ORDER": (
        "Timestamps decreased between steps in sequence order (ordering may be unreliable)."
    ),
    "NO_RETRIEVAL_EVENTS": "No retrieval events were recorded before tool observations.",
    "MISSING_RUN_COMPLETED": "No run_completed control event was recorded after tool observations.",
}


def user_phrase_for_reason_code(code: str) -> str:
    return SQL_VERIFICATION_PHRASES.get(code, f"Verification issue (code {code}).")
