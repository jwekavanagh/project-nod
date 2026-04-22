# Framework integration lock

Pinned third-party versions are enforced in CI via optional dependency installs. Import paths below must remain importable when those extras are installed.

## CrewAI

- **Packages**: `crewai` (see `pyproject.toml` `[project.optional-dependencies].crewai`).
- **Hook surface**: `crewai.hooks.before_tool_call` — register a global hook for the duration of `agentskeptic.verify()`.
- **Trust boundary**: `before_tool_call` (parameters visible before tool side effects).
- **Rejected alternatives**: crew-scoped decorators only (we use global registration scoped by context manager lifetime).

## AutoGen (AgentChat)

- **Packages**: `autogen-agentchat` (optional extra `autogen`).
- **Hook surface**: `autogen_agentchat.base._chat_agent` / team stream APIs vary by minor version — **integration tests** pin the import used in `agentskeptic/_integrations/autogen.py`.
- **Trust boundary**: end of each `Team.run` / streamed task completion (flush verify on context exit).
- **Rejected alternatives**: per-message monkeypatch of internal `_sleep` helpers.

## LangGraph (Python)

- **Packages**: `langgraph`, `langchain-core` (optional extra `langgraph`).
- **Hook surface**: **Wrapped checkpointer** — subclass/wrapper delegating to the user’s `BaseCheckpointSaver` and capturing `(thread_id, checkpoint_ns, checkpoint_id)` on `put` / `put_writes` when available.
- **Trust boundary**: after checkpoint materialization (same tuple as persisted checkpoint).
- **Rejected alternatives**: `ToolNode` monkeypatch; requiring users to edit every `@tool` body.

## Version pins (minimum tested)

| Package | Minimum |
|---------|---------|
| `crewai` | 0.80.0 |
| `autogen-agentchat` | 0.4.0 |
| `langgraph` | 0.2.0 |
| `langchain-core` | 0.3.0 |
