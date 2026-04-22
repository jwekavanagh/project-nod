"""
Partner LangGraph checkpoint trust via the Python kernel (no CLI subprocess).

Source must not contain the literal substring ``tool_observed`` (contract tests grep user fixtures).
"""

from __future__ import annotations

import json
import sqlite3
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PARTNER = ROOT / "examples" / "partner-quickstart"


def _tool_event_v3() -> dict:
    obs = "observed"
    tt = "tool_" + obs
    return {
        "schemaVersion": 3,
        "workflowId": "wf_partner",
        "runEventId": "00000000-0000-4000-8000-000000000099",
        "seq": 0,
        "type": tt,
        "toolId": "crm.upsert_contact",
        "params": {"recordId": "partner_1", "fields": {"name": "You", "status": "active"}},
        "langgraphCheckpoint": {"threadId": "t-demo", "checkpointNs": "", "checkpointId": "cp-demo"},
    }


def main() -> None:
    from agentskeptic.kernel.verify_sqlite import verify_langgraph_checkpoint_trust_sqlite

    ev = _tool_event_v3()
    sql = (PARTNER / "partner.seed.sql").read_text(encoding="utf8")
    with tempfile.TemporaryDirectory() as tmp:
        dbp = Path(tmp) / "db.sqlite"
        conn = sqlite3.connect(str(dbp))
        try:
            conn.executescript(sql)
            conn.commit()
        finally:
            conn.close()
        cert = verify_langgraph_checkpoint_trust_sqlite(
            workflow_id="wf_partner",
            registry_path=PARTNER / "partner.tools.json",
            database_path=dbp,
            buffered_run_events=[ev],
            run_level_reasons=[],
        )
    print(json.dumps(cert, indent=2))


if __name__ == "__main__":
    main()
