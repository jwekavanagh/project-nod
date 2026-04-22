"""Smoke-import optional framework packages when extras are installed (CI matrix)."""

import importlib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
LOCK = ROOT / "python" / "FRAMEWORK_LOCK.md"


@pytest.mark.skipif(not LOCK.exists(), reason="FRAMEWORK_LOCK.md missing")
def test_lock_file_exists() -> None:
    text = LOCK.read_text(encoding="utf8")
    assert "CrewAI" in text
    assert "LangGraph" in text


def _try_import(mod: str) -> bool:
    try:
        importlib.import_module(mod)
        return True
    except ImportError:
        return False


@pytest.mark.skipif(not _try_import("crewai"), reason="crewai extra not installed")
def test_crewai_hook_module_importable() -> None:
    importlib.import_module("crewai.hooks")


@pytest.mark.skipif(not _try_import("langgraph"), reason="langgraph extra not installed")
def test_langgraph_importable() -> None:
    importlib.import_module("langgraph.checkpoint.sqlite")
