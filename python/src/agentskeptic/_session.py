from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from agentskeptic.kernel.verify_sqlite import (
    verify_contract_sql_certificate_sqlite,
    verify_langgraph_checkpoint_trust_sqlite,
)


class VerificationSession:
    """Buffers tool_observed events and flushes to the Python kernel."""

    def __init__(
        self,
        *,
        framework: str,
        workflow_id: str,
        database_url: str,
        registry: str | Path,
    ) -> None:
        self.framework = framework
        self.workflow_id = workflow_id
        self.database_url = database_url
        self.registry = Path(registry)
        self.buffered: list[dict[str, Any]] = []
        self.run_level_reasons: list[dict[str, Any]] = []
        self._seq = 0
        self._root_run_event_id = str(uuid.uuid4())
        self.last_certificate: dict[str, Any] | None = None

    def append_malformed(self, reason: dict[str, Any]) -> None:
        self.run_level_reasons.append(reason)

    def append_tool_v1(self, tool_id: str, params: dict[str, Any]) -> None:
        ev = {
            "schemaVersion": 1,
            "workflowId": self.workflow_id,
            "seq": self._seq,
            "type": "tool_observed",
            "toolId": tool_id,
            "params": params,
        }
        self._seq += 1
        self.buffered.append(ev)

    def append_tool_v3_langgraph(
        self,
        tool_id: str,
        params: dict[str, Any],
        *,
        thread_id: str,
        checkpoint_ns: str,
        checkpoint_id: str,
    ) -> None:
        ev = {
            "schemaVersion": 3,
            "workflowId": self.workflow_id,
            "runEventId": str(uuid.uuid4()),
            "type": "tool_observed",
            "seq": self._seq,
            "toolId": tool_id,
            "params": params,
            "langgraphCheckpoint": {
                "threadId": thread_id,
                "checkpointNs": checkpoint_ns,
                "checkpointId": checkpoint_id,
            },
        }
        self._seq += 1
        self.buffered.append(ev)

    def flush_certificate(self) -> dict[str, Any]:
        db = self.database_url
        if self.framework == "langgraph":
            cert = verify_langgraph_checkpoint_trust_sqlite(
                workflow_id=self.workflow_id,
                registry_path=self.registry,
                database_path=db,
                buffered_run_events=self.buffered,
                run_level_reasons=self.run_level_reasons,
            )
        else:
            cert = verify_contract_sql_certificate_sqlite(
                workflow_id=self.workflow_id,
                registry_path=self.registry,
                database_path=db,
                buffered_run_events=self.buffered,
                run_level_reasons=self.run_level_reasons,
            )
        self.last_certificate = cert
        return cert
