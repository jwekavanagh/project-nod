# CI enforcement (`enforce`)

This document is the CI enforcement SSOT.
Governance semantics (evidence model, material truth hash, migration, UI/export) are now defined in [`docs/governance.md`](governance.md).

## Product boundary

- `check` (and positional compatibility invocation) is local and stateless (single-run correctness).
- `enforce` is stateful and paid (correctness over time).
- Portable lock artifacts are not the authority for CI enforcement.

If your team needs baseline management, drift detection, and explicit change acceptance across runs, use `agentskeptic enforce` with a paid account.

## Prerequisites

- Commercial build of the CLI.
- Valid `AGENTSKEPTIC_API_KEY`.
- Successful reserve preflight (`POST /api/v1/usage/reserve` with `intent=enforce`).
- Active paid entitlement.

<!-- buyer-surface-ci-enforcement-metering:begin -->

## CI enforcement and metering

`agentskeptic enforce` governs correctness over time using product-managed baseline, drift detection, and acceptance state. It requires the commercial npm build, a valid `AGENTSKEPTIC_API_KEY`, and a successful `POST /api/v1/usage/reserve` with `intent=enforce` under an active paid plan. OSS/local `check` (and positional compatibility invocation) remains available for single-run checks, but does not provide authoritative cross-run enforcement state for CI teams.

<!-- buyer-surface-ci-enforcement-metering:end -->

## Stateful workflow

1. **Create baseline**
   - `agentskeptic enforce --workflow-id ... --events ... --registry ... --db ... --create-baseline`
2. **Check drift in CI**
   - `agentskeptic enforce --workflow-id ... --events ... --registry ... --db ...`
3. **Accept intended change**
   - `agentskeptic enforce --workflow-id ... --events ... --registry ... --db ... --accept-drift`
   - Requires environment pins **`AGENTSKEPTIC_ENFORCE_EXPECTED_PROJECTION_HASH`**, **`AGENTSKEPTIC_ENFORCE_LIFECYCLE_STATE_VERSION`**, **`AGENTSKEPTIC_ACCEPT_REASON`**, and **`AGENTSKEPTIC_ACCEPT_OWNER`** (optional **`AGENTSKEPTIC_ACCEPT_REVIEW_BY`**, **`AGENTSKEPTIC_ACCEPT_EVIDENCE_LINKS`** as JSON array string).

## Exit behavior

- `0`: pass (or baseline/accept completed with complete result)
- `1|2`: underlying verification status inconsistent/incomplete (governance POST may still have succeeded; see [`docs/ambient-ci-distribution.md`](ambient-ci-distribution.md) enforce-mode summary for `VERIFY_INCOMPLETE`)
- `3`: operational failure (API, reserve, entitlement, transport). The commercial CLI typically **does not print** the `{ "schemaVersion": 2, "enforce": … }` stdout line on non-2xx hosted responses—triage from stderr **CLI error envelope** lines instead.
- `4`: drift detected in stateful check

## GitHub Actions: governance job summary (`mode: enforce`)

When the composite action runs with **`mode: enforce`**, [`outcome-ci-surface.mjs`](../.github/actions/agentskeptic-check/outcome-ci-surface.mjs) appends a **Governance** block to `$GITHUB_STEP_SUMMARY` and writes nine fixed **`GITHUB_OUTPUT`** keys (sorted in goldens under `test/fixtures/outcome-ci-surface/`):

| Output key | Role |
|------------|------|
| `agentskeptic-governance-step` | Deterministic operator step (`STEADY_OK`, `ACCEPT_DRIFT_PINNED`, `DRIFT_NO_PIN`, `RERUN_PASS`, `RERUN_FAIL`, `BASELINE_CREATED`, `ACCEPT_RECORDED_RERUN_CHECK`, `MALFORMED_ENVELOPE`, `OVERSIZED_STDOUT`, `HOSTED_OR_USAGE_ERROR`, `VERIFY_INCOMPLETE`) |
| `agentskeptic-governance-lifecycle-state` | Hosted `lifecycle_state` or empty |
| `agentskeptic-governance-lifecycle-state-version` | Stringified `lifecycle_state_version` or empty |
| `agentskeptic-governance-result-status` | V1 `result_status`; empty for V2 baseline / V3 accept bodies |
| `agentskeptic-governance-decision-reason-code` | `decision_reason_code` when present |
| `agentskeptic-governance-expected-projection-hash-for-accept` | Accept pin from the envelope, or empty |
| `agentskeptic-governance-next-action` | First line of hosted `next_action`, or a fixed literal for malformed/unknown-inner/oversized rows |
| `agentskeptic-governance-accept-available` | `true` only when a non-empty accept pin is present on the envelope |
| `agentskeptic-governance-pass-kind` | Hosted `pass_kind` on trusted **200** `POST /check` completions (`baseline_match` or `governed_acceptance_active`); empty when absent |

Certificate-mode outputs (`state-relation`, `trust-decision`, …) remain **empty** on the enforce governance path. **Rebaseline** (`ENFORCE_BASELINE_REBASE_REQUIRED`, HTTP non-2xx before stdout is written) is explained here and in migration notes in [`docs/governance.md`](governance.md); it does not produce a governance stdout row.

Copy [`examples/github-actions/agentskeptic-commercial.yml`](../examples/github-actions/agentskeptic-commercial.yml) for a three-job layout: baseline dispatch, PR drift check, and optional accept dispatch with `AGENTSKEPTIC_ENFORCE_*` env pins plus **`AGENTSKEPTIC_ACCEPT_REASON`** and **`AGENTSKEPTIC_ACCEPT_OWNER`** for governed accept.

## Notes

- `--expect-lock` and `--output-lock` are removed from enforcement semantics.
- OSS `verify` remains usable, but it does not provide authoritative cross-run enforcement state.
