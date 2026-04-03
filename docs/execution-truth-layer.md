# Execution Truth Layer (MVP) — Single Source of Truth

This document is the authoritative specification for the MVP. The product verifies **external SQL state** against expectations derived from **observed tool calls** and a **tool registry**, never from agent-reported success alone.

## Why this shape

- **NDJSON events**: One line per tool invocation provides a concrete “observe each step” capture surface that any agent stack can implement by appending JSON after each tool call.
- **Tool registry (`tools.json`)**: Keeps “intent → expected state” inside the product using RFC 6901 JSON Pointers into `params`, so events do not carry caller-supplied expectation blobs.
- **SQLite via `node:sqlite`**: Read-only `SELECT` against a file path gives reproducible ground truth in CI. The reference plan named `better-sqlite3`; this repo uses Node’s built-in module (**Node ≥ 22.13**) to avoid native compilation on constrained environments while preserving the same SQL contract (`SELECT * … WHERE … = ? LIMIT 2`, bound parameters only).

## Audiences

### Engineer

| Module | Role |
|--------|------|
| `schemaLoad.ts` | AJV 2020-12 validators for event line, registry, workflow result |
| `loadEvents.ts` | Read NDJSON, validate, filter `workflowId`, sort by `seq`, detect `DUPLICATE_SEQ` |
| `resolveExpectation.ts` | Registry + params → `VerificationRequest`; `intendedEffect` template rendering (audit only) |
| `sqlConnector.ts` | Parameterized read; lowercase column keys |
| `reconciler.ts` | Deterministic rule table (below) |
| `aggregate.ts` | Workflow status precedence |
| `pipeline.ts` | Orchestration: `verifyWorkflow`, `verifyToolObservedStep`, `withWorkflowVerification` |
| `cli.ts` | CLI entry |

### Engineer note: shared step core

`verifyToolObservedStep` in `pipeline.ts` is shared by `withWorkflowVerification` (in-process) and `verifyWorkflow` (NDJSON batch). **Why:** One reconciliation path; batch and in-process cannot drift.

### Integrator

### Low-friction integration (in-process)

Primary integration for running workflows in code: **`await withWorkflowVerification(options, run)`** from `pipeline.ts` (re-exported in the package entry). The `run` callback receives **`observeStep`**; call it after each tool with one [event line](#event-line-schema) object. There is **no** public `finish` — the library closes the read-only SQLite handle in a `finally` block after `run` completes or throws.

**Why:** One root boundary; library owns DB close in finally; avoids silent leaks when integrators omit a terminal call.

Normative contracts:

- **`observeStep` input:** Only a JavaScript **non-null object** is schema-validated against the event schema; **strings and primitives are not parsed as NDJSON**—non-objects yield **`MALFORMED_EVENT_LINE`** (same run-level meaning as a bad NDJSON line in batch mode).
- **`withWorkflowVerification` return:** **`Promise<WorkflowResult>`** fulfilled on success; **rejected** on invalid registry/DB setup (before `run`) or if **`run`** throws or rejects — after the DB is closed in **`finally`**.
- **Post-close `observeStep`:** If a caller keeps the injected function and uses it after the run, it throws **`Error`** with message **`Workflow verification observeStep invoked after workflow run completed`**.
- **Parity:** Feeding the same event objects in file order as an NDJSON workflow must match **`verifyWorkflow`** on that file for the same `workflowId`, `registryPath`, and `dbPath`.

### Batch and CLI (replay)

For CI, audits, or logs written as NDJSON:

1. To verify your checkout with bundled `examples/` artifacts, run `npm run first-run` from the repository root (see [Examples](#examples)). It builds the project, creates `examples/demo.db` from `seed.sql`, and runs two sample workflows.
2. After **each** tool call, append one JSON object line to your NDJSON file (see [Event line schema](#event-line-schema)).
3. Maintain `tools.json` with one entry per `toolId` your workflows emit.
4. Run:

```bash
npm run build
node dist/cli.js --workflow-id <id> --events <path> --registry <path> --db <path>
```

**Why:** Same event contract for CI and external logs without requiring in-process wrapper.

**Exit codes**

| Code | `workflow.status` |
|------|-------------------|
| 0 | `complete` |
| 1 | `inconsistent` |
| 2 | `incomplete` |

**stderr**: One JSON object per processed step (`intendedEffect`, `verificationRequest`, `status`, `reasons`, `evidenceSummary`).

**stdout**: Single JSON object matching `schemas/workflow-result.schema.json`.

### Operator

- DB user should be **read-only** in production.
- SQLite file must exist when `readOnly: true` is used (Node `DatabaseSync`).
- Redact secrets from `params` before writing events if logs are retained; **redact params in retained logs** when those logs leave the trust boundary.

## Event line schema

File: [`schemas/event.schema.json`](../schemas/event.schema.json).

Required fields per line:

- `schemaVersion`: `1`
- `workflowId`, `seq` (non-negative integer, monotonic per workflow in normal operation)
- `type`: `tool_observed`
- `toolId`, `params` (object)

**Not allowed on the event (MVP):** `expectation` / `verification` objects — the resolver must derive verification from the registry.

## Tool registry

File: [`schemas/tools-registry.schema.json`](../schemas/tools-registry.schema.json).

Each entry:

- `toolId` (unique)
- `effectDescriptionTemplate`: string with `{/json/pointer}` tokens → replaced with `JSON.stringify(value)` or `MISSING` (audit string only; **not** used for reconciliation).
- `verification`: `{ "kind": "sql_row", "table", "key", "requiredFields" }` where `table` / `key.column` / `key.value` / `requiredFields` use `{ "const": … }` or `{ "pointer": "/path" }`.

Resolved internal shape:

```json
{
  "kind": "sql_row",
  "table": "string",
  "keyColumn": "string",
  "keyValue": "string",
  "requiredFields": { "col": "expectedString" }
}
```

`requiredFields` values must be **strings** (MVP). Empty object = **presence-only** (row must exist).

### Resolver error codes → step `incomplete_verification`

| Code | Meaning |
|------|---------|
| `UNKNOWN_TOOL` | `toolId` not in registry |
| `RESOLVE_POINTER` | Missing pointer, wrong type, or non-string field value where required |
| `INVALID_IDENTIFIER` | Table / column / `requiredFields` key not matching `^[a-zA-Z_][a-zA-Z0-9_]*$` |

## SQL connector contract

- Only query: `SELECT * FROM "<table>" WHERE "<keyColumn>" = ? LIMIT 2` with `String(keyValue)` bound.
- Column names in results are normalized to **lowercase** before reconciliation.

## Reconciler rule table (`sql_row`)

Precondition: iterate `requiredFields` keys in **lexicographic** order.

Let `n = rows.length` after `LIMIT 2`.

1. Connector throws → `incomplete_verification` / `CONNECTOR_ERROR`.
2. `n === 0` → `missing` / `ROW_ABSENT`.
3. `n >= 2` → `inconsistent` / `DUPLICATE_ROWS` (no field inspection).
4. `n === 1`, row `row`, for each key `k` in sorted order, `col = k.toLowerCase()`:
   - `col` not in `row` → `incomplete_verification` / `ROW_SHAPE_MISMATCH`.
   - `row[col]` is `null` or `undefined` → `partial` / `NULL_FIELD` (stop further checks for classification).
   - `typeof row[col] === "object"` and not `null` and not `Date` → `incomplete_verification` / `UNREADABLE_VALUE`.
   - Compare `String(row[col]).trim()` to `String(requiredFields[k]).trim()`; unequal → `inconsistent` / `VALUE_MISMATCH`.
5. All fields pass (or `requiredFields` empty) → `verified`.

No coercion beyond `String()` / `trim()`.

## Workflow status (PRD-aligned)

Step statuses: `verified` | `missing` | `partial` | `inconsistent` | `incomplete_verification`.

| Workflow status | Condition |
|-----------------|-----------|
| `incomplete` | Any run-level code (`MALFORMED_EVENT_LINE`, `DUPLICATE_SEQ`, …), **or** zero steps, **or** any step `incomplete_verification`. |
| `inconsistent` | Not incomplete as above, and any step in `{ missing, partial, inconsistent }`. |
| `complete` | Not incomplete, every step `verified`. |

**PRD mapping:** PRD §4 “Failed” (determinate bad outcome) ↔ `inconsistent`. §4 “Incomplete” (cannot confirm) ↔ `incomplete`. §6 three bullets ↔ these three strings.

## Validation matrix (what CI proves vs operations)

| Claim | Proven in CI / local | Proven in production / pilot only |
|-------|----------------------|-----------------------------------|
| No `complete` without SQL verification | Yes — integration tests | — |
| Four falsifiable step outcomes + duplicates / unknown tool / dup seq / malformed line | Yes — `npm test` | — |
| Framework-agnostic capture | Yes — NDJSON contract + examples | Integration list / adapters |
| Manual verification steps ↓, time-to-confirm ↓, trust / re-runs | No | Metrics & study (define counters in ops) |

**Engineering MVP “solved”:** `npm test` passes; CLI obeys exit codes; contracts match this document.

## Examples

Bundled files under [`examples/`](../examples/): `seed.sql`, `tools.json`, `events.ndjson`.

- **Onboarding:** run `npm run first-run` from the repository root. The onboarding driver is [`scripts/first-run.mjs`](../scripts/first-run.mjs), invoked only via that npm script (`npm run build && node scripts/first-run.mjs`). It seeds `examples/demo.db`, then verifies workflows `wf_complete` (expect `complete` / `verified`) and `wf_missing` (expect `inconsistent` / `missing` / `ROW_ABSENT`).

(Node may print an experimental warning for `node:sqlite` depending on version.)
