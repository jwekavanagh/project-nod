from __future__ import annotations

from typing import Any

from agentskeptic.kernel.support_core import format_operational_message
from agentskeptic.kernel.verification_diagnostics import format_verification_target_summary, sanitize_one_line

LINE_PREFIX_DECLARED = "declared: "
LINE_PREFIX_EXPECTED = "expected: "
LINE_PREFIX_OBSERVED_DATABASE = "observed_database: "
LINE_PREFIX_VERIFICATION_VERDICT = "verification_verdict: "

EXPECTED_NONE_NO_SQL = "(none — no resolvable SQL expectation)"


def format_batch_observed_state_summary(step: dict[str, Any]) -> str:
    req = step.get("verificationRequest")
    ev = step.get("evidenceSummary") or {}
    if req is None:
        raw = "No SQL verification request (registry resolution or unknown tool)."
    elif isinstance(req, dict) and req.get("kind") == "sql_row":
        row_count = ev.get("rowCount")
        if isinstance(row_count, int):
            if ev.get("field") is not None and ev.get("expected") is not None and ev.get("actual") is not None:
                raw = (
                    f"rowCount={row_count} field={str(ev['field'])} "
                    f"expected={str(ev['expected'])} actual={str(ev['actual'])}"
                )
            else:
                raw = f"rowCount={row_count}"
        else:
            raw = "SQL evidence present (no rowCount in summary)."
    else:
        raw = "SQL evidence present (no rowCount in summary)."
    return format_operational_message(raw)


def format_batch_declared_stderr_value(tool_id: str, intent_narrative: str, params_canonical: str) -> str:
    intent = (
        "(none)"
        if intent_narrative.strip() == ""
        else intent_narrative.replace("\t", " ").replace("\r", " ").replace("\n", " ")
    )
    intent = " ".join(intent.split()).strip()
    raw = f"tool={tool_id}; intent={intent}; parameters_digest={params_canonical}"
    return format_operational_message(raw)


def format_batch_expected_stderr_value(verify_target: str | None) -> str:
    if verify_target is None or verify_target == "":
        return EXPECTED_NONE_NO_SQL
    return format_operational_message(verify_target)


def format_batch_verification_verdict_stderr_value(
    outcome_label: str, human_phrase: str, failure_category: str | None = None
) -> str:
    raw = f"outcome={outcome_label}; {human_phrase}"
    if failure_category is not None and len(failure_category) > 0:
        raw += f"; failure_category={failure_category}"
    return format_operational_message(raw)
