from __future__ import annotations

import sqlite3
from typing import Any

from agentskeptic.kernel.resolve_expectation import VerificationRequestSqlRow
from agentskeptic.kernel.support_core import format_operational_message
from agentskeptic.kernel.value_verification import verification_scalars_equal

SQL_VERIFICATION_OUTCOME_CODE = {
    "ROW_ABSENT": "ROW_ABSENT",
    "DUPLICATE_ROWS": "DUPLICATE_ROWS",
    "ROW_SHAPE_MISMATCH": "ROW_SHAPE_MISMATCH",
    "UNREADABLE_VALUE": "UNREADABLE_VALUE",
    "VALUE_MISMATCH": "VALUE_MISMATCH",
    "CONNECTOR_ERROR": "CONNECTOR_ERROR",
    "UNKNOWN_TOOL": "UNKNOWN_TOOL",
    "RETRY_OBSERVATIONS_DIVERGE": "RETRY_OBSERVATIONS_DIVERGE",
}

MAX_VERIFICATION_SAMPLE_ROWS = 3


class ConnectorError(Exception):
    pass


def _quote_ident(id_: str) -> str:
    return '"' + id_.replace('"', '""') + '"'


def build_select_by_identity_sql_sqlite(req: VerificationRequestSqlRow) -> tuple[str, list[str]]:
    table = _quote_ident(req["table"])
    conds: list[str] = []
    values: list[str] = []
    for pair in req["identityEq"]:
        conds.append(f"{table}.{_quote_ident(pair['column'])} = ?")
        values.append(str(pair["value"]))
    text = f"SELECT * FROM {table} WHERE {' AND '.join(conds)} LIMIT 2"
    return text, values


def fetch_rows_for_verification(conn: sqlite3.Connection, req: VerificationRequestSqlRow) -> list[dict[str, Any]]:
    text, values = build_select_by_identity_sql_sqlite(req)
    try:
        cur = conn.execute(text, values)
        cols = [d[0].lower() for d in cur.description] if cur.description else []
        rows = []
        for r in cur.fetchall():
            rows.append({cols[i]: r[i] for i in range(len(cols))})
        return rows
    except sqlite3.Error as e:
        raise ConnectorError(str(e)) from e


def row_key_context(req: VerificationRequestSqlRow) -> str:
    t = format_operational_message(req["table"])
    parts = [
        f"{format_operational_message(p['column'])}={format_operational_message(p['value'])}"
        for p in req["identityEq"]
    ]
    return f"table={t} {' '.join(parts)}"


def reconcile_from_rows(rows: list[dict[str, Any]], req: VerificationRequestSqlRow) -> dict[str, Any]:
    n = len(rows)
    ctx = row_key_context(req)
    if n == 0:
        return {
            "status": "missing",
            "reasons": [{"code": SQL_VERIFICATION_OUTCOME_CODE["ROW_ABSENT"], "message": f"No row matched key ({ctx})"}],
            "evidenceSummary": {"rowCount": 0},
        }
    if n >= 2:
        return {
            "status": "inconsistent",
            "reasons": [
                {
                    "code": SQL_VERIFICATION_OUTCOME_CODE["DUPLICATE_ROWS"],
                    "message": f"More than one row matched key ({ctx})",
                }
            ],
            "evidenceSummary": {"rowCount": n},
        }
    row = rows[0]
    keys = sorted(req["requiredFields"].keys(), key=lambda a: a.lower())
    for k in keys:
        col = k.lower()
        if col not in row:
            return {
                "status": "incomplete_verification",
                "reasons": [
                    {
                        "code": SQL_VERIFICATION_OUTCOME_CODE["ROW_SHAPE_MISMATCH"],
                        "message": f"Column not in row: {k} ({ctx})",
                    }
                ],
                "evidenceSummary": {"rowCount": 1, "rowKeys": list(row.keys())},
            }
        actual = row[col]
        if isinstance(actual, (dict, list)) and actual is not None:
            return {
                "status": "incomplete_verification",
                "reasons": [
                    {
                        "code": SQL_VERIFICATION_OUTCOME_CODE["UNREADABLE_VALUE"],
                        "message": f"Non-scalar value for {k} ({ctx})",
                        "field": k,
                    }
                ],
                "evidenceSummary": {"rowCount": 1, "field": k},
            }
        expected_val = req["requiredFields"][k]
        cmp = verification_scalars_equal(expected_val, actual)
        if not cmp.get("ok"):
            assert cmp["ok"] is False
            message = (
                f"Expected {cmp['expected']} but found {cmp['actual']} for field {k} ({ctx})"
            )
            return {
                "status": "inconsistent",
                "reasons": [{"code": SQL_VERIFICATION_OUTCOME_CODE["VALUE_MISMATCH"], "message": message, "field": k}],
                "evidenceSummary": {"rowCount": 1, "field": k, "expected": cmp["expected"], "actual": cmp["actual"]},
            }
    return {"status": "verified", "reasons": [], "evidenceSummary": {"rowCount": 1}}


def reconcile_sql_row(conn: sqlite3.Connection, req: VerificationRequestSqlRow) -> dict[str, Any]:
    try:
        rows = fetch_rows_for_verification(conn, req)
    except ConnectorError as e:
        return {
            "status": "incomplete_verification",
            "reasons": [
                {
                    "code": SQL_VERIFICATION_OUTCOME_CODE["CONNECTOR_ERROR"],
                    "message": format_operational_message(str(e)),
                }
            ],
            "evidenceSummary": {"rowCount": None, "error": True},
        }
    return reconcile_from_rows(rows, req)
