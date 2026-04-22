from __future__ import annotations


def sample_tool(record_id: str, fields: dict[str, str]) -> str:
    return record_id


def test_emit_tools_json_validates() -> None:
    from agentskeptic.tools.emit_registry import emit_tools_json

    out = emit_tools_json([sample_tool], default_table="contacts", id_param="record_id")
    assert "py.sample_tool" in out
    assert "contacts" in out
