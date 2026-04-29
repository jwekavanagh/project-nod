"""Backward-compatible public errors; prefer `agentskeptic.errors.AgentSkepticError` in new code."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from agentskeptic.errors import AgentSkepticError


class TrustDecisionBlockedError(AgentSkepticError):
    """Raised when an irreversible-action gate blocks on trust (parity with npm `TrustDecisionBlockedError`)."""

    def __init__(
        self,
        message: str,
        *,
        trust_decision: str,
        record: Mapping[str, Any] | None = None,
        code: str = "INTERNAL_ERROR",
    ) -> None:
        super().__init__(code, message)
        self.trust_decision = trust_decision
        self.record: dict[str, Any] = dict(record) if record is not None else {}
