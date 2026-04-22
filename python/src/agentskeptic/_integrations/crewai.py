from __future__ import annotations

from typing import Any, Callable

from agentskeptic._session import VerificationSession

_hook_registered: list[Callable[..., None]] = []


def attach_crewai(session: VerificationSession, tool_id_resolver: Callable[[Any], str] | None = None) -> Callable[[], None]:
    try:
        from crewai.hooks import before_tool_call
    except ImportError as e:
        raise ImportError("crewai is required for framework='crewai'. pip install 'agentskeptic[crewai]'") from e

    def _default_tool_id(ctx: Any) -> str:
        return str(getattr(ctx, "tool_name", "") or getattr(ctx, "tool_id", "") or "unknown_tool")

    resolver = tool_id_resolver or _default_tool_id

    @before_tool_call
    def _hook(ctx: Any) -> None:  # type: ignore[misc]
        tool_id = resolver(ctx)
        tool_input = getattr(ctx, "tool_input", None)
        params: dict[str, Any] = tool_input if isinstance(tool_input, dict) else {}
        session.append_tool_v1(tool_id, params)

    _hook_registered.append(_hook)
    return lambda: None


def detach_crewai() -> None:
    """CrewAI hooks are process-global; best-effort no-op teardown (hook remains until process exit)."""
    _hook_registered.clear()
