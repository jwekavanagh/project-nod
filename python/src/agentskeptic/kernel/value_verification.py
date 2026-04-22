from __future__ import annotations

import json
import math
from datetime import datetime
from typing import Any, Literal, TypedDict, Union

VerificationScalar = Union[str, int, float, bool, None]


class CmpOk(TypedDict):
    ok: Literal[True]


class CmpFail(TypedDict):
    ok: Literal[False]
    expected: str
    actual: str


Cmp = CmpOk | CmpFail


def canonical_verification_display_for_expected(v: VerificationScalar) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        if math.isnan(v):
            return "NaN"
        if v == float("inf"):
            return "Infinity"
        if v == float("-inf"):
            return "-Infinity"
        return str(v)
    if isinstance(v, int):
        return str(v)
    return json.dumps(v)


def canonical_verification_display_for_actual(actual: Any) -> str:
    if actual is None:
        return "null"
    if isinstance(actual, bool):
        return "true" if actual else "false"
    if isinstance(actual, float):
        if math.isnan(actual):
            return "NaN"
        if actual == float("inf"):
            return "Infinity"
        if actual == float("-inf"):
            return "-Infinity"
        return str(actual)
    if isinstance(actual, int):
        return str(actual)
    if isinstance(actual, str):
        return json.dumps(actual)
    if isinstance(actual, bytes):
        return json.dumps(actual.decode("utf-8", errors="replace"))
    if isinstance(actual, datetime):
        if math.isnan(actual.timestamp()):
            return json.dumps(None)
        return json.dumps(actual.isoformat())
    return json.dumps(str(actual))


def verification_scalars_equal(expected: VerificationScalar, actual: Any) -> Cmp:
    def fail() -> CmpFail:
        return {
            "ok": False,
            "expected": canonical_verification_display_for_expected(expected),
            "actual": canonical_verification_display_for_actual(actual),
        }

    if expected is None:
        if actual is None:
            return {"ok": True}
        return fail()

    if actual is None:
        return fail()

    if isinstance(expected, bool):
        ok = (isinstance(actual, bool) and actual is expected) or (
            isinstance(actual, (int, float))
            and math.isfinite(float(actual))
            and ((expected is True and float(actual) == 1.0) or (expected is False and float(actual) == 0.0))
        )
        return {"ok": True} if ok else fail()

    if isinstance(expected, (int, float)):
        if isinstance(expected, float) and not math.isfinite(expected):
            return fail()
        exp = float(expected) if isinstance(expected, int) else expected
        if isinstance(actual, (int, float)) and math.isfinite(float(actual)) and float(actual) == float(exp):
            return {"ok": True}
        if isinstance(actual, int) and isinstance(expected, int) and actual == expected:
            return {"ok": True}
        if isinstance(actual, str):
            try:
                parsed = json.loads(actual.strip())
                if isinstance(parsed, (int, float)) and float(parsed) == float(exp):
                    return {"ok": True}
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
        return fail()

    if isinstance(expected, str):
        e = expected.strip()
        if isinstance(actual, str) and actual.strip() == e:
            return {"ok": True}
        if isinstance(actual, (int, float)) and math.isfinite(float(actual)) and e == json.dumps(actual):
            return {"ok": True}
        if isinstance(actual, bool) and e == json.dumps(actual):
            return {"ok": True}
        if isinstance(actual, datetime) and e == actual.isoformat():
            return {"ok": True}
        return fail()

    return fail()
