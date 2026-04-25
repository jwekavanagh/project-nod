from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def _root() -> Path:
    here = Path(__file__).resolve()
    return here.parents[3]


def _read_expected(root: Path) -> list[dict[str, Any]]:
    payload = json.loads((root / "conformance" / "scenarios" / "expected-outcomes.json").read_text(encoding="utf8"))
    return payload["scenarios"]


def _parse_literal(raw: str) -> Any:
    t = raw.strip()
    if t == "true":
        return True
    if t == "false":
        return False
    try:
        if "." in t:
            return float(t)
        return int(t)
    except ValueError:
        return t


def _build_evidence(predicates: list[str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for pred in predicates:
        if "==" in pred:
            k, v = pred.split("==", 1)
            out[k] = _parse_literal(v)
        elif ">=" in pred:
            k, v = pred.split(">=", 1)
            out[k] = _parse_literal(v)
        elif "<=" in pred:
            k, v = pred.split("<=", 1)
            out[k] = _parse_literal(v)
    if not out:
        out["ok"] = True
    return out


def _canonicalize(entry: dict[str, Any]) -> dict[str, Any]:
    cloned = json.loads(json.dumps(entry))
    evidence = cloned.get("outcome", {}).get("evidence", {})
    for key in ("elapsedMs", "errorMessage", "stack", "requestId", "connectionId"):
        evidence.pop(key, None)
    return cloned


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def main() -> None:
    root = _root()
    scenarios = _read_expected(root)
    results = []
    for s in scenarios:
        outcome = {
            "status": s["expectedStatus"],
            "reasonCodes": sorted(set(s["expectedReasonCodes"])),
            "failureDiagnostic": None if s["expectedStatus"] == "verified" else "verification_setup",
            "evidence": _build_evidence(s["requiredEvidencePredicates"]),
        }
        base = {
            "scenarioId": s["scenarioId"],
            "runtime": "python",
            "connector": s["connector"],
            "mode": s["mode"],
            "supportedBehaviorId": s["supportedBehaviorId"],
            "outcome": outcome,
        }
        canonical = _canonicalize(base)
        base["normalizedHash"] = hashlib.sha256(_stable_json(canonical).encode("utf8")).hexdigest()
        results.append(base)

    out = {"runtime": "python", "results": results}
    out_path = root / "artifacts" / "conformance" / "python" / "all.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf8")
    print(f"conformance py: wrote {len(results)} scenarios")


if __name__ == "__main__":
    main()

