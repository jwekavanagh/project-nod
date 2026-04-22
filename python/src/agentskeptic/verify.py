from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator, Literal

from agentskeptic._session import VerificationSession

FrameworkName = Literal["crewai", "autogen", "langgraph"]


@contextmanager
def verify(
    *,
    framework: FrameworkName,
    workflow_id: str,
    database_url: str,
    registry: str | Path,
    crew: Any | None = None,
    compiled: Any | None = None,
    team: Any | None = None,
    tool_id_resolver: Callable[[Any], str] | None = None,
    langgraph_tool_id: str = "crm.upsert_contact",
    langgraph_tool_params: dict[str, Any] | None = None,
    langgraph_capture: Callable[[dict[str, Any], Any], tuple[str, dict[str, Any]]] | None = None,
) -> Iterator[VerificationSession]:
    """
    Single public entrypoint: instrument agent execution and flush verification on exit.

    ``database_url`` must be a filesystem path to a SQLite database (``file:`` URI or plain path).
    """
    session = VerificationSession(
        framework=framework,
        workflow_id=workflow_id,
        database_url=database_url,
        registry=registry,
    )
    restore_cp: tuple[Any, Any] | None = None
    try:
        if framework == "crewai":
            if crew is None:
                raise TypeError("verify(...): crew= is required when framework='crewai'")
            from agentskeptic._integrations.crewai import attach_crewai

            attach_crewai(session, tool_id_resolver)
        elif framework == "autogen":
            if team is None:
                raise TypeError("verify(...): team= is required when framework='autogen'")
            from agentskeptic._integrations.autogen import attach_autogen

            attach_autogen(session, team)
        elif framework == "langgraph":
            if compiled is None:
                raise TypeError("verify(...): compiled= is required when framework='langgraph'")
            cp = getattr(compiled, "checkpointer", None)
            if cp is None:
                raise TypeError("verify(...): compiled.checkpointer must be set for LangGraph capture")
            orig_put = getattr(cp, "put", None)
            params = langgraph_tool_params or {
                "recordId": "partner_1",
                "fields": {"name": "You", "status": "active"},
            }

            def _capture(config: dict[str, Any], checkpoint: Any) -> tuple[str, dict[str, Any]]:
                if langgraph_capture is not None:
                    return langgraph_capture(config, checkpoint)
                return langgraph_tool_id, params

            def put_wrapped(config: dict[str, Any], checkpoint: Any, metadata: Any, new_versions: Any) -> Any:
                tid, p = _capture(config, checkpoint)
                cfg = config.get("configurable") or {}
                thread_id = str(cfg.get("thread_id") or "default-thread")
                checkpoint_ns = str(cfg.get("checkpoint_ns", "") or "")
                if isinstance(checkpoint, dict):
                    cp_id = str(checkpoint.get("id") or "unknown-checkpoint")
                else:
                    cp_id = str(getattr(checkpoint, "id", None) or "unknown-checkpoint")
                session.append_tool_v3_langgraph(
                    tid,
                    p,
                    thread_id=thread_id,
                    checkpoint_ns=checkpoint_ns,
                    checkpoint_id=cp_id,
                )
                assert orig_put is not None
                return orig_put(config, checkpoint, metadata, new_versions)

            cp.put = put_wrapped  # type: ignore[method-assign]
            restore_cp = (cp, orig_put)
        else:
            raise ValueError(f"Unknown framework: {framework}")
        yield session
    finally:
        if restore_cp is not None:
            cp_obj, orig = restore_cp
            if orig is not None:
                cp_obj.put = orig  # type: ignore[method-assign]
        session.flush_certificate()
