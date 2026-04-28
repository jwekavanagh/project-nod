# Release verification log

Entries are recorded after each successful automated release bootstrap per [CONTRIBUTING.md](../CONTRIBUTING.md) (Releases canonical).

## 2026-04-28 (UTC) — duplicate npm 1.2.0 recovery

- **Context:** Release workflow failed on `main` with `npm error You cannot publish over the previously published versions: 1.2.0` (registry already had 1.2.0 and 1.2.1 from an earlier line; `latest` remains 1.1.3 until a successful publish).
- **Recovery:** Pushed **`v1.2.1`** tag on the same commit as **`v1.2.0`** so semantic-release treats the last release as **1.2.1**; follow-up **`fix(release)`** PR lands **1.2.2** on npm/PyPI/GitHub.
- **Post-merge:** Re-run should show `RELEASE_OUTCOME=CREATED` and `npm view agentskeptic version` **1.2.2** (and `latest` updated if that is the intended dist-tag policy).
