from __future__ import annotations

import json
import sqlite3
import tempfile
from pathlib import Path

import os
import pytest


def _repo_root() -> Path:
    env = os.environ.get("AGENTSKEPTIC_REPO_ROOT")
    if env:
        p = Path(env)
        if (p / "examples" / "partner-quickstart" / "partner.seed.sql").is_file():
            return p
    here = Path(__file__).resolve()
    for cand in here.parents:
        if (cand / "examples" / "partner-quickstart" / "partner.seed.sql").is_file():
            return cand
    raise RuntimeError(
        "Could not locate examples/partner-quickstart (run from repo root or set AGENTSKEPTIC_REPO_ROOT)",
    )


ROOT = _repo_root()
PARTNER = ROOT / "examples" / "partner-quickstart"
VECTORS = Path(__file__).resolve().parent / "parity_vectors"


def _seed_db(path: Path) -> None:
    sql = (PARTNER / "partner.seed.sql").read_text(encoding="utf8")
    conn = sqlite3.connect(str(path))
    try:
        conn.executescript(sql)
        conn.commit()
    finally:
        conn.close()


def _load_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf8"))


def test_partner_contract_sql_matches_golden() -> None:
    from agentskeptic.kernel.verify_sqlite import verify_contract_sql_certificate_sqlite

    golden = _load_json(VECTORS / "partner_contract_sql" / "golden_certificate.json")
    events_line = (PARTNER / "partner.events.ndjson").read_text(encoding="utf8").strip()
    ev = json.loads(events_line)
    with tempfile.TemporaryDirectory() as tmp:
        dbp = Path(tmp) / "db.sqlite"
        _seed_db(dbp)
        got = verify_contract_sql_certificate_sqlite(
            workflow_id="wf_partner",
            registry_path=PARTNER / "partner.tools.json",
            database_path=dbp,
            buffered_run_events=[ev],
            run_level_reasons=[],
        )
    assert got == golden


def test_partner_langgraph_row_b_matches_golden() -> None:
    from agentskeptic.kernel.verify_sqlite import verify_langgraph_checkpoint_trust_sqlite

    golden = _load_json(VECTORS / "partner_langgraph_row_b" / "golden_certificate.json")
    ev = {
        "schemaVersion": 3,
        "workflowId": "wf_partner",
        "runEventId": "00000000-0000-4000-8000-000000000001",
        "type": "tool_observed",
        "seq": 0,
        "toolId": "crm.upsert_contact",
        "params": {"recordId": "partner_1", "fields": {"name": "You", "status": "active"}},
        "langgraphCheckpoint": {"threadId": "t-contract", "checkpointNs": "", "checkpointId": "cp-contract"},
    }
    with tempfile.TemporaryDirectory() as tmp:
        dbp = Path(tmp) / "db.sqlite"
        _seed_db(dbp)
        got = verify_langgraph_checkpoint_trust_sqlite(
            workflow_id="wf_partner",
            registry_path=PARTNER / "partner.tools.json",
            database_path=dbp,
            buffered_run_events=[ev],
            run_level_reasons=[],
        )
    assert got == golden


def test_langgraph_a2_malformed_matches_golden() -> None:
    from agentskeptic.kernel.verify_sqlite import verify_langgraph_checkpoint_trust_sqlite

    golden = _load_json(VECTORS / "langgraph_a2_malformed" / "golden_certificate.json")
    rlr = [
        {
            "code": "MALFORMED_EVENT_LINE",
            "message": (
                "Event line was missing, invalid JSON, or failed schema validation for a tool observation."
            ),
        }
    ]
    got = verify_langgraph_checkpoint_trust_sqlite(
        workflow_id="wf_partner",
        registry_path=PARTNER / "partner.tools.json",
        database_path=PARTNER / "partner.tools.json",
        buffered_run_events=[],
        run_level_reasons=rlr,
    )
    assert got == golden
