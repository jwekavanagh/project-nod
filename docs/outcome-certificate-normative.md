# Outcome Certificate v2 — normative (public contract)

This document is the **sole product authority** for the **Outcome Certificate**: trust boundary, field semantics, the **`highStakesReliance` derivation table**, and the canonical **`evidenceCompleteness`** object. Engine internals (`WorkflowResult`, reconciler codes, NDJSON) remain in [`agentskeptic.md`](agentskeptic.md).

**v3 wire (authoritative for current builds):** top-level **`schemaVersion`** is **`3`** only—**there is no v4**. Optional **`correctnessDefinition`** on the certificate mirrors [`workflowTruthReport.correctnessDefinition`](../schemas/workflow-truth-report.schema.json#/$defs/correctnessDefinitionV1) when present (attestation / storage). Optional **`evidenceCompleteness.rerunReadiness`** is defined in [`schemas/evidence-completeness-v1.schema.json`](../schemas/evidence-completeness-v1.schema.json).

## Trust boundary (unchanged intent)

- The certificate proves **observed SQL state vs expectations** derived from structured tool activity and the registry (contract) or inferred mapping (quick preview)—**not** that a tool executed, and **not** generic observability.
- Verification is a **snapshot** at read time.

## Top-level fields (v2)

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Wire version; must be **`2`** for this document’s stdout contract. |
| `workflowId` | Workflow under verification. |
| `runKind` | `contract_sql` (registry-backed), `contract_sql_langgraph_checkpoint_trust` (LangGraph checkpoint trust; v3 NDJSON wire only), or `quick_preview` (inferred). |
| `checkpointVerdicts` | Optional; present on eligible LangGraph checkpoint trust runs after SQL. Omitted for ineligible LangGraph (A2). |
| `stateRelation` | `matches_expectations` \| `does_not_match` \| `not_established` — SQL vs expectations only. |
| `highStakesReliance` | `permitted` \| `prohibited` — may this artifact gate ship / bill / compliance decisions. |
| `relianceRationale` | One mandatory human string explaining `highStakesReliance`. |
| `intentSummary` | Stakeholder-safe summary of intended verification scope. |
| `explanation` | `{ headline, details[] }` with stable `code` + `message` pairs (forensics). |
| `steps` | Per-step plain language: declared action, expected outcome, observed outcome. |
| `humanReport` | Byte-stable human rendering including the **`=== evidence_completeness ===`** … **`=== end evidence_completeness ===`** anchored block alongside the structural truth summary. |
| **`evidenceCompleteness`** | **Required.** Canonical five-question summary: blocker category (`blockerCategory`), quick rollup signal (`quickSignal`), verified/unverified claims, missing inputs (`missingInputs[]`), and next actions (`nextActions`). Schema fragment: **`schemas/evidence-completeness-v1.schema.json`**. |

### `highStakesReliance` derivation (normative)

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
- `humanReport`: structural human report text from the finalized truth report plus evidence completeness anchors.
- **No commercial fields** on the certificate (billing gates execution **before** emission).

## JSON Schemas

- **Certificate (stdout — current product):** [`schemas/outcome-certificate-v2.schema.json`](../schemas/outcome-certificate-v2.schema.json)
- **Evidence completeness fragment:** [`schemas/evidence-completeness-v1.schema.json`](../schemas/evidence-completeness-v1.schema.json)
- **`OutcomeCertificate` v1 (frozen legacy):** [`schemas/outcome-certificate-v1.schema.json`](../schemas/outcome-certificate-v1.schema.json) — **regression tooling and historical pinned tests only**, not validators for live CLI or website ingestion.

## Quick Verify report alignment

Structured quick output conforms to **`schemas/quick-verify-report.schema.json`** (**`schemaVersion` 5**) and carries the **same-shaped** **`evidenceCompleteness`** object as certificates. See **`docs/quick-verify-normative.md`**.

## Share envelope v3 (POST new writes only)

[`schemas/public-verification-report-v3.schema.json`](../schemas/public-verification-report-v3.schema.json) — POST body **`{ "schemaVersion": 3, "certificate": <OutcomeCertificateV2> }`**. Older **v1 / v2** rows may still be served by **`GET /r/{id}`** (frozen renderer); **new ingestion accepts v3 only** (v2 POST bodies return **400**).

## Hosted enforcement lifecycle (verification FSM)

This section anchors **commercial hosted workflow posture** keyed by `(user_id, workflow_id)` for evidence-native enforcement. **`lifecycle_state*` names here are authoritative**; downstream docs cite this section rather than inferring terminology from legacy event strings.

### Governance evidence POST (**`schema_version` 3**)

**`POST /api/v1/enforcement/check`**, **`POST /api/v1/enforcement/baselines`**, and **`POST /api/v1/enforcement/accept`** accept **only**:

```json
{
  "schema_version": 3,
  "run_id": "string",
  "workflow_id": "string",
  "outcome_certificate": { },
  "material_truth_sha256": "string",
  "certificate_sha256": "string"
}
```

- **`outcome_certificate`** MUST be **`Outcome Certificate v2`** (`schemaVersion` **2**) including **`evidenceCompleteness`**.
- Requests naming **`outcome_certificate_v1`** or **`schema_version` 2** are rejected with **400** (single stable **`detail`** string in OpenAPI / route).

### Material truth

Material truth projections use **`schemas/material-truth-v2.schema.json`** (includes **`evidenceGapPrimary`** mirroring **`evidenceCompleteness.blockerCategory`**). Drift compares **`material_truth_sha256`**.

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

**HTTP `409` responses remain verification attempts**: the server persists the decision bundle (including **`attempt_id`**) alongside `lifecycle_*` fields. Responses use the **lifecycle FSM envelope** documented in **`schemas/openapi-commercial-v1.yaml`**.

### Procedural accept (`POST /accept`)

Accept mutates **`lifecycle_state` → `rerun_required`**, refreshes stored baseline projections, and writes an audited transition — **never** emitting `decision_state`/`decision_blocked`/`decision_trusted` semantics for that POST. Operational trust resumes only after a subsequent successful **`POST /check`**.

Implementations derive guard rails from typed pure functions exported as `verificationLifecycle.ts` (`evaluateCheck`, `evaluateCreateBaseline`, `evaluateAccept`, reducer `applyFsmNormalizedEvent`); governance exports SHOULD include `fsmTransitions`, `verificationDecisions`, and the current **`lifecycle`** row for audit completeness.
