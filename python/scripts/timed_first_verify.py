#!/usr/bin/env python3
"""Wall-clock smoke: Python conformance runner."""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    budget = float(os.environ.get("TIMED_VERIFY_BUDGET_S", "900"))
    t0 = time.perf_counter()
    r = subprocess.run([sys.executable, "-m", "agentskeptic_conformance.run"], cwd=str(root.parent), check=False)
    elapsed = time.perf_counter() - t0
    print(f"timed_first_verify: elapsed_s={elapsed:.3f} budget_s={budget} exit={r.returncode}")
    if elapsed > budget:
        print(f"timed_first_verify: FAIL exceeded budget ({elapsed:.3f}s > {budget}s)", file=sys.stderr)
        sys.exit(2)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
