from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    import psycopg

from agentskeptic.kernel.reconciler_sqlite import (
    SQL_VERIFICATION_OUTCOME_CODE,
    _quote_ident,
    reconcile_from_rows,
)
from agentskeptic.kernel.resolve_expectation import VerificationRequestSqlRow
from agentskeptic.kernel.support_core import format_operational_message


def _require_psycopg() -> type:
    try:
        import psycopg as _p  # type: ignore[import-untyped]
    except ImportError as e:  # pragma: no cover
        raise ImportError("PostgreSQL support requires: pip install 'agentskeptic[postgres]'") from e
    return _p


def build_select_by_identity_sql_postgres(req: VerificationRequestSqlRow) -> tuple[str, list[str]]:
    table = _quote_ident(req["table"])
    conds: list[str] = []
    values: list[str] = []
    for pair in req["identityEq"]:
        # psycopg uses `%s` placeholders (not `$1`, `$2`).
        conds.append(f"{table}.{_quote_ident(pair['column'])} = %s")
        values.append(str(pair["value"]))
    text = f"SELECT * FROM {table} WHERE {' AND '.join(conds)} LIMIT 2"
    return text, values


def fetch_rows_for_verification_postgres(conn: "psycopg.Connection", req: VerificationRequestSqlRow) -> list[dict[str, Any]]:
    text, values = build_select_by_identity_sql_postgres(req)
    with conn.cursor() as cur:
        cur.execute(text, values)
        desc = [d[0] for d in (cur.description or [])]
        cols = [c.lower() for c in desc]
        rows: list[dict[str, Any]] = []
        for r in cur.fetchall():
            rows.append({cols[i]: r[i] for i in range(len(cols))})
    return rows


def reconcile_sql_row_postgres(conn: "psycopg.Connection", req: VerificationRequestSqlRow) -> dict[str, Any]:
    pgm = _require_psycopg()
    try:
        rows = fetch_rows_for_verification_postgres(conn, req)
    except (pgm.Error, OSError) as e:
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
