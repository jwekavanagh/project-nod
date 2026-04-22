from __future__ import annotations

from typing import Any

from agentskeptic._session import VerificationSession


def attach_autogen(session: VerificationSession, team: Any) -> None:
    """Attach to an AutoGen team run stream when API is available (optional dependency)."""
    try:
        from autogen_agentchat.messages import ToolCallExecutionEvent  # noqa: F401
    except ImportError as e:
        raise ImportError(
            "autogen-agentchat is required for framework='autogen'. pip install 'agentskeptic[autogen]'"
        ) from e

    _ = (session, team)
    raise NotImplementedError(
        "AutoGen capture adapter is stubbed: install autogen-agentchat and extend attach_autogen per FRAMEWORK_LOCK.md"
    )
