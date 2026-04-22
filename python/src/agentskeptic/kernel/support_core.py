from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

OPERATIONAL_MESSAGE_MAX_CHARS = 2048

RETRY_OBSERVATIONS_DIVERGE_MESSAGE = (
    "Multiple observations for this seq do not all match the last observation (toolId and canonical params)."
)


def format_operational_message(raw: str) -> str:
    s = re.sub(r"[\t\r\n]", " ", raw)
    s = re.sub(r" +", " ", s).strip()
    if len(s) > OPERATIONAL_MESSAGE_MAX_CHARS:
        return s[: OPERATIONAL_MESSAGE_MAX_CHARS - 3] + "..."
    return s


def compare_utf16_id(a: str, b: str) -> int:
    if a < b:
        return -1
    if a > b:
        return 1
    return 0


def get_pointer(doc: Any, pointer: str) -> Any:
    if pointer == "":
        return doc
    if not pointer.startswith("/"):
        raise ValueError(f"Invalid JSON Pointer: must start with /, got {json.dumps(pointer)}")
    parts = pointer[1:].split("/")
    parts = [p.replace("~1", "/").replace("~0", "~") for p in parts]
    cur: Any = doc
    for tok in parts:
        if cur is None or not isinstance(cur, (dict, list)):
            return None
        if isinstance(cur, list):
            idx = int(tok, 10) if tok.isdigit() else -1
            if str(idx) != tok or idx < 0 or idx >= len(cur):
                return None
            cur = cur[idx]
        else:
            if tok not in cur:
                return None
            cur = cur[tok]
    return cur


def canonical_json_for_params(value: Any) -> str:
    if value is None or isinstance(value, (bool, int, float, str)):
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ",".join(canonical_json_for_params(el) for el in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        parts = [f"{json.dumps(k, separators=(',', ':'))}:{canonical_json_for_params(value[k])}" for k in keys]
        return "{" + ",".join(parts) + "}"
    return f"__non_json_params:{type(value).__name__}__"


_IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def is_valid_ident(s: str) -> bool:
    return bool(_IDENT.match(s))


def tools_registry_schema_path() -> Path:
    """Resolve ``schemas/tools-registry.schema.json`` (repo root or slim Docker layout under ``/app``)."""
    p = Path(__file__).resolve()
    for anc in p.parents:
        cand = anc / "schemas" / "tools-registry.schema.json"
        if cand.is_file():
            return cand
    raise FileNotFoundError(f"schemas/tools-registry.schema.json not found (search from {p})")
