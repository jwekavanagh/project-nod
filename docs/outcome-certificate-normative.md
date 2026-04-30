# Outcome Certificate v1 — normative (public contract)

This document is the **sole product authority** for the **Outcome Certificate**: trust boundary, field semantics, and the **`highStakesReliance` derivation table**. Engine internals (`WorkflowResult`, reconciler codes, NDJSON) remain in [`agentskeptic.md`](agentskeptic.md).

## Trust boundary (unchanged intent)

- The certificate proves **observed SQL state vs expectations** derived from structured tool activity and the registry (contract) or inferred mapping (quick preview)—**not** that a tool executed, and **not** generic observability.
- Verification is a **snapshot** at read time.

## Top-level fields (v1)

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Wire version; must be `1` for this document. |
| `workflowId` | Workflow under verification. |
| `runKind` | `contract_sql` (registry-backed), `contract_sql_langgraph_checkpoint_trust` (LangGraph checkpoint trust; v3 wire only), or `quick_preview` (inferred). |
| `checkpointVerdicts` | Optional; present on eligible LangGraph checkpoint trust runs after SQL. Omitted for ineligible LangGraph (A2). |
| `stateRelation` | `matches_expectations` \| `does_not_match` \| `not_established` — SQL vs expectations only. |
| `highStakesReliance` | `permitted` \| `prohibited` — may this artifact gate ship / bill / compliance decisions. |
| `relianceRationale` | One mandatory human string explaining `highStakesReliance`. |
| `intentSummary` | Stakeholder-safe summary of intended verification scope. |
| `explanation` | `{ headline, details[] }` with stable `code` + `message` pairs (forensics). |
| `steps` | Per-step plain language: declared action, expected outcome, observed outcome. |
| `humanReport` | Byte-stable human rendering; must equal `formatOutcomeCertificateHuman(certificate)` in the implementation. |

## `highStakesReliance` derivation (normative)

Materialized `highStakesReliance` **must** equal `derive(runKind, stateRelation)`:

| runKind | stateRelation | highStakesReliance |
|---------|---------------|-------------------|
| `quick_preview` | any | `prohibited` |
| `contract_sql` | `matches_expectations` | `permitted` |
| `contract_sql` | `does_not_match` | `prohibited` |
| `contract_sql` | `not_established` | `prohibited` |
| `contract_sql_langgraph_checkpoint_trust` | `matches_expectations` | `permitted` |
| `contract_sql_langgraph_checkpoint_trust` | `does_not_match` | `prohibited` |
| `contract_sql_langgraph_checkpoint_trust` | `not_established` | `prohibited` |

## Mapping from engine `WorkflowResult` (contract)

- `stateRelation`: `complete` → `matches_expectations`; `inconsistent` → `does_not_match`; `incomplete` → `not_established`.
- `humanReport`: structural human report text from the finalized truth report (`formatWorkflowTruthReportStruct`).
- **No commercial fields** on the certificate (billing gates execution **before** emission).

## JSON Schema

[`schemas/outcome-certificate-v1.schema.json`](../schemas/outcome-certificate-v1.schema.json)

## Share envelope v2

[`schemas/public-verification-report-v2.schema.json`](../schemas/public-verification-report-v2.schema.json) — POST body `{ "schemaVersion": 2, "certificate": <OutcomeCertificateV1> }`. Legacy v1 rows may still be served by GET `/r/{id}` (frozen renderer); new writes use v2 only.

## Hosted enforcement lifecycle (verification FSM)

This section anchors **commercial hosted workflow posture** keyed by `(user_id, workflow_id)` for evidence-native enforce (`schema_version` 2 governance payloads). **`lifecycle_state*` names here are authoritative**; downstream docs cite this section rather than inferring terminology from legacy event strings.

### Workflow posture enum (`lifecycle_state`)

- `baseline_missing` — No accepted baseline projection for the workflow yet.
- `baseline_active` — Stored baseline projection exists and is current for matching checks **after** any required rerun (see transitions).
- `action_required` — Drift (or rerun failure while expecting reconciliation) blocks returning to solely-trusted posture until remediation and/or an explicit procedural accept pins the acknowledgement contract.
- `rerun_required` — After procedural **accept**, the caller must rerun `POST /check` so verification re-asserts against the newly accepted baseline before returning to **`baseline_active`**.

Workflow posture is mutable over time and is exposed on API responses as **`lifecycle_state`** plus optimistic concurrency counter **`lifecycle_state_version`**.

### Verification decision artifacts (`POST /check`, `POST /baselines`)

Each hosted **verification attempt** terminates in exactly one persisted verdict:

| Field | Values |
|-------|--------|
| `decision_state` | `decision_trusted` \| `decision_blocked` (immutable row per attempt) |
| `decision_reason_code` | Canonical machine reason (e.g. `BASELINE_MISSING`, `CHECK_MATCH`, `DRIFT_DETECTED`, `RERUN_PASS`, …) |

**HTTP `409` responses remain verification attempts**: the server persists the decision bundle (including **`attempt_id`**) alongside `lifecycle_*` fields. Clients must parse `schema_version` 2 envelopes and **`code`** (e.g. `ENFORCE_REMEDIATION_ACK_REQUIRED`, `ENFORCE_BASELINE_REQUIRED`).

### Procedural accept (`POST /accept`)

Accept mutates **`lifecycle_state` → `rerun_required`**, refreshes stored baseline projections, and writes an audited transition — **never** emitting `decision_state`/`decision_blocked`/`decision_trusted` semantics for that POST. Operational trust resumes only after a subsequent successful **`POST /check`**.

Implementations derive guard rails from typed pure functions exported as `verificationLifecycle.ts` (`evaluateCheck`, `evaluateCreateBaseline`, `evaluateAccept`, reducer `applyFsmNormalizedEvent`); governance exports SHOULD include `fsmTransitions`, `verificationDecisions`, and the current **`lifecycle`** row for audit completeness.
