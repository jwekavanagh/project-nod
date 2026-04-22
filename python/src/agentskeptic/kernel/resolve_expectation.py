from __future__ import annotations

import json
import re
from typing import Any, Literal, TypedDict, Union

from agentskeptic.kernel.support_core import compare_utf16_id, get_pointer, is_valid_ident
from agentskeptic.kernel.value_verification import VerificationScalar

REGISTRY_RESOLVER_CODE = {
    "TABLE_POINTER_INVALID": "TABLE_POINTER_INVALID",
    "TABLE_SPEC_INVALID": "TABLE_SPEC_INVALID",
    "INVALID_IDENTIFIER": "INVALID_IDENTIFIER",
    "REQUIRED_FIELDS_POINTER_MISSING": "REQUIRED_FIELDS_POINTER_MISSING",
    "REQUIRED_FIELDS_NOT_OBJECT": "REQUIRED_FIELDS_NOT_OBJECT",
    "REQUIRED_FIELDS_VALUE_UNDEFINED": "REQUIRED_FIELDS_VALUE_UNDEFINED",
    "REQUIRED_FIELDS_VALUE_NOT_SCALAR": "REQUIRED_FIELDS_VALUE_NOT_SCALAR",
    "STRING_SPEC_POINTER_MISSING": "STRING_SPEC_POINTER_MISSING",
    "STRING_SPEC_TYPE": "STRING_SPEC_TYPE",
    "STRING_SPEC_EMPTY": "STRING_SPEC_EMPTY",
    "KEY_VALUE_POINTER_MISSING": "KEY_VALUE_POINTER_MISSING",
    "KEY_VALUE_NOT_SCALAR": "KEY_VALUE_NOT_SCALAR",
    "KEY_VALUE_SPEC_INVALID": "KEY_VALUE_SPEC_INVALID",
    "EQUALITY_DUPLICATE_COLUMN": "EQUALITY_DUPLICATE_COLUMN",
}

SQL_VERIFICATION_OUTCOME_CODE = {
    "UNKNOWN_TOOL": "UNKNOWN_TOOL",
    "ROW_ABSENT": "ROW_ABSENT",
    "DUPLICATE_ROWS": "DUPLICATE_ROWS",
    "ROW_SHAPE_MISMATCH": "ROW_SHAPE_MISMATCH",
    "UNREADABLE_VALUE": "UNREADABLE_VALUE",
    "VALUE_MISMATCH": "VALUE_MISMATCH",
    "CONNECTOR_ERROR": "CONNECTOR_ERROR",
    "RETRY_OBSERVATIONS_DIVERGE": "RETRY_OBSERVATIONS_DIVERGE",
}

UNKNOWN_TOOL = SQL_VERIFICATION_OUTCOME_CODE["UNKNOWN_TOOL"]


class IdentityEqPair(TypedDict):
    column: str
    value: str


class VerificationRequestSqlRow(TypedDict):
    kind: Literal["sql_row"]
    table: str
    identityEq: list[IdentityEqPair]
    requiredFields: dict[str, VerificationScalar]


class ResolveOkSqlRow(TypedDict):
    ok: Literal[True]
    verificationKind: Literal["sql_row"]
    request: VerificationRequestSqlRow


class ResolveErr(TypedDict):
    ok: Literal[False]
    code: str
    message: str


ResolveResult = Union[ResolveOkSqlRow, ResolveErr]


class ToolRegistryEntry(TypedDict, total=False):
    toolId: str
    effectDescriptionTemplate: str
    verification: dict[str, Any]


def render_intended_effect(template: str, params: dict[str, Any]) -> str:
    def repl(m: re.Match[str]) -> str:
        ptr = m.group(1)
        v = get_pointer(params, ptr)
        if v is None:
            return "MISSING"
        return json.dumps(v, separators=(",", ":"), ensure_ascii=False)

    return re.sub(r"\{(/[^{}]+)\}", repl, template)


def _resolve_string_spec(
    spec: dict[str, Any], params: dict[str, Any], label: str
) -> tuple[bool, str, str]:
    if "const" in spec and "pointer" not in spec:
        v = spec.get("const")
        if not isinstance(v, str) or len(v) == 0:
            return False, REGISTRY_RESOLVER_CODE["STRING_SPEC_EMPTY"], f"{label}: const must be non-empty string"
        return True, v, ""
    ptr = spec.get("pointer")
    if not isinstance(ptr, str):
        return False, REGISTRY_RESOLVER_CODE["KEY_VALUE_SPEC_INVALID"], f"{label}: invalid spec"
    got = get_pointer(params, ptr)
    if got is None:
        return False, REGISTRY_RESOLVER_CODE["STRING_SPEC_POINTER_MISSING"], f"{label}: missing at {ptr}"
    if not isinstance(got, str):
        return False, REGISTRY_RESOLVER_CODE["STRING_SPEC_TYPE"], f"{label}: expected string at {ptr}"
    if len(got) == 0:
        return False, REGISTRY_RESOLVER_CODE["STRING_SPEC_EMPTY"], f"{label}: empty string at {ptr}"
    return True, got, ""


def _resolve_key_value(spec: dict[str, Any], params: dict[str, Any]) -> tuple[bool, str, str]:
    if "const" in spec and "pointer" not in spec:
        return True, str(spec["const"]), ""
    ptr = spec.get("pointer")
    if isinstance(ptr, str):
        got = get_pointer(params, ptr)
        if got is None:
            return False, REGISTRY_RESOLVER_CODE["KEY_VALUE_POINTER_MISSING"], f"key.value missing at {ptr}"
        if isinstance(got, (dict, list)):
            return False, REGISTRY_RESOLVER_CODE["KEY_VALUE_NOT_SCALAR"], "key.value must be scalar at " + ptr
        return True, str(got), ""
    return False, REGISTRY_RESOLVER_CODE["KEY_VALUE_SPEC_INVALID"], "value: invalid spec"


def _normalize_sorted_identity_eq(
    raw: list[dict[str, str]], label_prefix: str
) -> tuple[bool, list[IdentityEqPair] | None, str, str]:
    sorted_pairs = sorted(raw, key=lambda p: p["column"])
    for i in range(1, len(sorted_pairs)):
        if sorted_pairs[i]["column"] == sorted_pairs[i - 1]["column"]:
            return (
                False,
                None,
                REGISTRY_RESOLVER_CODE["EQUALITY_DUPLICATE_COLUMN"],
                f"{label_prefix}duplicate equality column: {sorted_pairs[i]['column']}",
            )
    out: list[IdentityEqPair] = [{"column": p["column"], "value": p["value"]} for p in sorted_pairs]
    return True, out, "", ""


def resolve_sql_row_spec(params: dict[str, Any], spec: dict[str, Any], label_prefix: str) -> ResolveResult:
    table_spec = spec.get("table")
    if isinstance(table_spec, dict) and "const" in table_spec and "pointer" not in table_spec:
        table_val = table_spec["const"]
        if not isinstance(table_val, str):
            return {
                "ok": False,
                "code": REGISTRY_RESOLVER_CODE["TABLE_SPEC_INVALID"],
                "message": f"{label_prefix}table: invalid spec",
            }
    elif isinstance(table_spec, dict) and "pointer" in table_spec:
        tptr = table_spec["pointer"]
        if not isinstance(tptr, str):
            return {
                "ok": False,
                "code": REGISTRY_RESOLVER_CODE["TABLE_SPEC_INVALID"],
                "message": f"{label_prefix}table: invalid spec",
            }
        got = get_pointer(params, tptr)
        if got is None or not isinstance(got, str) or len(got) == 0:
            return {
                "ok": False,
                "code": REGISTRY_RESOLVER_CODE["TABLE_POINTER_INVALID"],
                "message": f"{label_prefix}table: expected non-empty string at {tptr}",
            }
        table_val = got
    else:
        return {
            "ok": False,
            "code": REGISTRY_RESOLVER_CODE["TABLE_SPEC_INVALID"],
            "message": f"{label_prefix}table: invalid spec",
        }

    if not isinstance(table_val, str) or not is_valid_ident(table_val):
        return {
            "ok": False,
            "code": REGISTRY_RESOLVER_CODE["INVALID_IDENTIFIER"],
            "message": f"{label_prefix}table: {table_val}",
        }

    identity_specs = spec.get("identityEq")
    if not isinstance(identity_specs, list):
        return {"ok": False, "code": "INVALID", "message": "identityEq missing"}
    raw_pairs: list[dict[str, str]] = []
    for i, p in enumerate(identity_specs):
        if not isinstance(p, dict):
            continue
        ok_c, col, msg = _resolve_string_spec(p.get("column", {}), params, f"{label_prefix}identityEq[{i}].column")
        if not ok_c:
            return {"ok": False, "code": col, "message": msg}
        ok_v, val, msgv = _resolve_key_value(p.get("value", {}), params)
        if not ok_v:
            return {"ok": False, "code": val, "message": f"{label_prefix}identityEq[{i}]. {msgv}"}
        if not is_valid_ident(col):
            return {
                "ok": False,
                "code": REGISTRY_RESOLVER_CODE["INVALID_IDENTIFIER"],
                "message": f"{label_prefix}identityEq[{i}].column: {col}",
            }
        raw_pairs.append({"column": col, "value": val})

    ok_id, identity_eq, code, message = _normalize_sorted_identity_eq(raw_pairs, label_prefix)
    if not ok_id or identity_eq is None:
        return {"ok": False, "code": code, "message": message}

    rf = spec.get("requiredFields")
    if not isinstance(rf, dict) or "pointer" not in rf:
        return {"ok": False, "code": "INVALID", "message": "requiredFields"}
    fields_raw = get_pointer(params, rf["pointer"])
    if fields_raw is None:
        return {
            "ok": False,
            "code": REGISTRY_RESOLVER_CODE["REQUIRED_FIELDS_POINTER_MISSING"],
            "message": f"{label_prefix}requiredFields missing at {rf['pointer']}",
        }
    if not isinstance(fields_raw, dict) or isinstance(fields_raw, list):
        return {
            "ok": False,
            "code": REGISTRY_RESOLVER_CODE["REQUIRED_FIELDS_NOT_OBJECT"],
            "message": f"{label_prefix}requiredFields must be object at {rf['pointer']}",
        }

    required_fields: dict[str, VerificationScalar] = {}
    for k, val in fields_raw.items():
        if not is_valid_ident(k):
            return {
                "ok": False,
                "code": REGISTRY_RESOLVER_CODE["INVALID_IDENTIFIER"],
                "message": f"{label_prefix}requiredFields key: {k}",
            }
        if val is None:
            required_fields[k] = None
        elif isinstance(val, (str, int, float, bool)):
            required_fields[k] = val
        else:
            return {
                "ok": False,
                "code": REGISTRY_RESOLVER_CODE["REQUIRED_FIELDS_VALUE_NOT_SCALAR"],
                "message": f"{label_prefix}requiredFields.{k} must be string, number, boolean, or null",
            }

    return {
        "ok": True,
        "verificationKind": "sql_row",
        "request": {"kind": "sql_row", "table": table_val, "identityEq": identity_eq, "requiredFields": required_fields},
    }


def resolve_verification_request(entry: ToolRegistryEntry, params: dict[str, Any]) -> ResolveResult:
    v = entry.get("verification")
    if not isinstance(v, dict):
        return {"ok": False, "code": "UNSUPPORTED", "message": "bad verification"}
    kind = v.get("kind")
    if kind == "sql_row":
        return resolve_sql_row_spec(params, v, "")
    return {"ok": False, "code": "UNSUPPORTED", "message": f"kind {kind}"}


def build_registry_map(entries: list[ToolRegistryEntry]) -> dict[str, ToolRegistryEntry]:
    m: dict[str, ToolRegistryEntry] = {}
    for e in entries:
        tid = e.get("toolId")
        if not isinstance(tid, str):
            continue
        if tid in m:
            raise ValueError(f"Duplicate toolId in registry: {tid}")
        m[tid] = e
    return m
