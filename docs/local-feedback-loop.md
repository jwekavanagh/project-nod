# Local Feedback Loop (normative)

This document is the single operator-facing source of truth for the canonical local command:

```text
agentskeptic loop --workflow-id <id> --events <path> --registry <path> (--db <sqlitePath> | --postgres-url <url>)
```

## Purpose

`agentskeptic loop` is the default local path to get an immediate decision-grade trust verdict on real database state with historical context.

**Hosted commercial posture** (lifecycle states, rerun gates, procedural accept semantics) lives in **`docs/outcome-certificate-normative.md`** — Hosted enforcement lifecycle (verification FSM) — not here.

It always does all of the following in one run:
- verifies against the target database,
- emits normalized verdict output,
- emits contextual next action for non-trusted outcomes,
- persists run artifacts and updates local run history,
- auto-compares against the latest compatible prior run.

## Terminal contract

`loop` emits exactly this section order on stdout:

1. `VERDICT: TRUSTED|NOT TRUSTED|UNKNOWN`
2. `WHY: <single concise rationale>`
3. `LOCAL_REGRESSION_COMPARE: <no_anchor|summary>`
4. `NEXT_ACTION: <single actionable step>` (required for `NOT TRUSTED` and `UNKNOWN`; omitted for `TRUSTED`)
5. `RUN_REF: <capturedAt workflowId path>`

Exit codes:
- `0`: TRUSTED
- `1`: NOT TRUSTED
- `2`: UNKNOWN (verification completed but state not established / incomplete)
- `3`: operational failure (stderr carries one JSON error envelope; stdout still carries UNKNOWN contract block)

## Local run history contract

`loop` persists run history under:
- `~/.agentskeptic/runs/index.json`
- one run directory per execution containing:
  - `events.ndjson`
  - `workflow-result.json`
  - `outcome-certificate.json`

Index schema:
- `schemaVersion: 1`
- `runs[]` entries with `workflowId`, `capturedAt`, `runDir`, `workflowResultPath`, `eventsPath`, `outcomeCertificatePath`

User-facing invariants:
- every run is traceable by `(workflowId, capturedAt, artifact path)`,
- compare baseline selection is “latest compatible prior run” for the same `workflowId`,
- history is bounded by `--max-history-runs` (default `100`).

## Compatibility and scope

- `quick`, `crossing`, and `verify-integrator-owned` remain supported for specialized workflows and backward compatibility.
- Normalized trust verdict output is canonical on `loop` only.
- Advanced trend analysis, watch mode, and policy workflows are out of scope for this contract.
