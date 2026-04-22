from __future__ import annotations

import inspect
import json
from pathlib import Path
from typing import Any, Callable

import jsonschema


def emit_tools_json(
    callables: list[Callable[..., Any]],
    *,
    default_table: str = "contacts",
    id_param: str = "record_id",
) -> str:
    """
    Generate a minimal ``tools.json`` registry (``sql_row`` skeleton) from Python callables.
    Names map to ``toolId`` as ``py.<function_name>``.
    """
    entries: list[dict[str, Any]] = []
    for fn in callables:
        name = getattr(fn, "__name__", "tool")
        tool_id = f"py.{name}"
        sig = inspect.signature(fn)
        params = [p for p in sig.parameters.values() if p.kind not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)]
        ptr = f"/{id_param}" if any(p.name == id_param for p in params) else "/id"
        entries.append(
            {
                "toolId": tool_id,
                "effectDescriptionTemplate": f"Python tool {name} {{{ptr}}}",
                "verification": {
                    "kind": "sql_row",
                    "table": {"const": default_table},
                    "identityEq": [{"column": {"const": "id"}, "value": {"pointer": ptr}}],
                    "requiredFields": {"pointer": "/fields"},
                },
            }
        )
    from agentskeptic.kernel.support_core import tools_registry_schema_path

    schema_path = tools_registry_schema_path()
    schema = json.loads(schema_path.read_text(encoding="utf8"))
    jsonschema.validate(instance=entries, schema=schema)
    return json.dumps(entries, indent=2) + "\n"
