"""Guardrails for examples/python-verification/crewai_minimal.py (optional CrewAI extra)."""

from __future__ import annotations

import importlib.util
import py_compile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "examples" / "python-verification" / "crewai_minimal.py"


def _crewai_available() -> bool:
    return importlib.util.find_spec("crewai") is not None


def test_crewai_minimal_script_compiles() -> None:
    py_compile.compile(str(SCRIPT), doraise=True)


@pytest.mark.skipif(_crewai_available(), reason="requires CrewAI to be absent")
def test_crewai_minimal_exits_when_crewai_missing() -> None:
    spec = importlib.util.spec_from_file_location(
        "crewai_minimal_missing_dep_test", SCRIPT
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    with pytest.raises(SystemExit) as excinfo:
        spec.loader.exec_module(mod)
    assert "CrewAI is not installed" in str(excinfo.value)


@pytest.mark.integration
@pytest.mark.skipif(not _crewai_available(), reason="crewai extra not installed")
def test_crewai_minimal_runs_when_crewai_available(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AGENTSKEPTIC_SUPPRESS_DEPRECATION", "1")
    spec = importlib.util.spec_from_file_location(
        "crewai_minimal_integration_test", SCRIPT
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    rc = mod.main()
    assert rc == 0
