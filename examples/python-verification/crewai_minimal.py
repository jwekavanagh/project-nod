"""
Minimal CrewAI + AgentSkeptic example (deterministic, no LLM).

Shows where the CrewAI global hook from python/FRAMEWORK_LOCK.md attaches during
``AgentSkeptic.verify(framework="crewai")``, how buffered observations reach the
verification kernel, and how to read the resulting Outcome Certificate.

This is a minimal shape demo: a real Crew run would trigger ``crewai.hooks``
during ``crew.kickoff()``; here we record one matching observation through the
public session API after registration so the outcome stays deterministic.

Hook surface (pinned): ``crewai.hooks.before_tool_call``. See python/FRAMEWORK_LOCK.md.
"""

from __future__ import annotations

try:
    import crewai  # noqa: F401 — confirms optional extra; attach uses same module graph
    from crewai.hooks import before_tool_call  # noqa: F401 — framework lock surface
except ImportError:
    raise SystemExit(
        "CrewAI is not installed. Install the optional CrewAI example dependencies, "
        "then rerun this script."
    )

import json
import os
import sqlite3
import tempfile
from pathlib import Path

# Keep stdout as certificate JSON only (verify() emits DeprecationWarning once otherwise).
os.environ.setdefault("AGENTSKEPTIC_SUPPRESS_DEPRECATION", "1")

from agentskeptic import AgentSkeptic

ROOT = Path(__file__).resolve().parents[2]
PARTNER = ROOT / "examples" / "partner-quickstart"


def main() -> int:
    sql = (PARTNER / "partner.seed.sql").read_text(encoding="utf8")
    registry_path = PARTNER / "partner.tools.json"

    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "db.sqlite"
        conn = sqlite3.connect(str(db_path))
        try:
            conn.executescript(sql)
            conn.commit()
        finally:
            conn.close()

        skeptic = AgentSkeptic(registry_path=registry_path, database_url=str(db_path))
        # ``before_tool_call`` is registered for this block (see attach_crewai).
        with skeptic.verify(
            framework="crewai",
            workflow_id="wf_partner",
            crew=object(),
        ) as session:
            session.append_tool_v1(
                tool_id="crm.upsert_contact",
                params={
                    "recordId": "partner_1",
                    "fields": {"name": "You", "status": "active"},
                },
            )

        cert = session.last_certificate

    print(json.dumps(cert, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
