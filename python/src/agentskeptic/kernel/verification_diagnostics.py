from __future__ import annotations

from typing import Any

from agentskeptic.kernel.resolve_expectation import VerificationRequestSqlRow
from agentskeptic.kernel.support_core import OPERATIONAL_MESSAGE_MAX_CHARS, format_operational_message


def sanitize_one_line(value: str) -> str:
    s = value.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    s = " ".join(s.split()).strip()
    return format_operational_message(s)


def field_names_sorted(required_fields: dict[str, Any]) -> str:
    return ", ".join(sorted(required_fields.keys(), key=lambda a: a))


def identity_eq_one_line(pairs: list[dict[str, str]] | None) -> str:
    lst = sorted(pairs or [], key=lambda p: p["column"])
    parts = [f"{sanitize_one_line(p['column'])}={sanitize_one_line(p['value'])}" for p in lst]
    return ",".join(parts)


def format_verification_target_summary(req: Any) -> str | None:
    if req is None:
        return None
    if not isinstance(req, dict) or "kind" not in req:
        return None
    kind = req.get("kind")
    if kind == "sql_row":
        keys = field_names_sorted(req["requiredFields"])
        id_line = identity_eq_one_line(req.get("identityEq"))
        line = f"table={sanitize_one_line(req['table'])} identity=[{id_line}] required_fields=[{keys}]"
        return format_operational_message(line)
    return None


STEP_STATUS_TRUTH_LABELS = {
    "verified": "VERIFIED",
    "missing": "FAILED_ROW_MISSING",
    "inconsistent": "FAILED_VALUE_MISMATCH",
    "incomplete_verification": "INCOMPLETE_CANNOT_VERIFY",
    "partially_verified": "PARTIALLY_VERIFIED",
    "uncertain": "UNCERTAIN_NOT_OBSERVED_WITHIN_WINDOW",
}


def failure_diagnostic_for_step(step: dict[str, Any]) -> str | None:
    status = step.get("status")
    if status == "verified":
        return None
    if status in ("missing", "inconsistent", "partially_verified"):
        return "workflow_execution"
    if status == "uncertain":
        return "observation_uncertainty"
    if status == "incomplete_verification":
        return "verification_setup"
    return None


def with_failure_diagnostic(step: dict[str, Any]) -> dict[str, Any]:
    fd = failure_diagnostic_for_step(step)
    if step.get("status") == "verified":
        return {k: v for k, v in step.items() if k != "failureDiagnostic"}
    out = dict(step)
    if fd is not None:
        out["failureDiagnostic"] = fd
    return out


def enrich_steps_with_failure_diagnostics(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [with_failure_diagnostic(_strip_failure_diagnostic(s)) for s in steps]


def _strip_failure_diagnostic(step: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in step.items() if k != "failureDiagnostic"}
