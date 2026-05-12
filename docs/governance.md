# Governance SSOT

This document is the single source of truth for commercial governance.

## Model

- **GovernanceEvidence**: immutable evidence row containing **`outcome_certificate`** (Outcome Certificate **v3** JSON), **`certificate_sha256`**, **`material_truth_v2`** projection, and **`material_truth_sha256`**.
- **GovernanceBaseline**: per `(user_id, workflow_id)` pointer to an accepted evidence revision.
- **GovernanceEvent**: append-only transition row (`baseline_created`, `check_pass`, `drift_detected`, `drift_accepted`) with an evidence reference.
- **GovernanceAcceptance**: immutable governed drift-acceptance row on successful **`POST /api/v1/enforcement/accept`** with required **`acceptance_reason`** and **`acceptance_owner`**, optional HTTPS **`evidence_links`**, optional **`exception_review_by`** (strictly future at parse time), FK to **`governance_evidence`**, and denormalized **`accepted_material_truth_sha256`**. **`enforcement_baseline.active_acceptance_id`** points at the row until cleared by **successful `POST /baselines`**, **review-by expiry** at the start of a **`POST /check`** (which sets **`needs_rebaseline=true`** and returns **409 `ENFORCE_BASELINE_REBASE_REQUIRED`**), or the **trusted `RERUN_PASS`** check that completes post-accept certification (that single **200** response includes **`pass_kind: governed_acceptance_active`** and **`governed_acceptance_id`**; subsequent trusted checks use **`pass_kind: baseline_match`**).

## Material truth

Material truth is the deterministic projection from **Outcome Certificate v3** validated by **`schemas/material-truth-v2.schema.json`**. Drift compares only **`material_truth_sha256`** (hash churn is expected once when upgrading from historical v1 projections). **Operational steps for rebaseline, migration, and recurring `enforce` in CI** are documented in [`docs/ci-enforcement.md`](ci-enforcement.md).

## Quick trust boundary

- `runKind=quick_preview` can participate in governance lifecycle.
- Quick evidence is always `reliance_class=provisional`.
- Contract SQL evidence is `reliance_class=eligible`.

## API contract (evidence POST)

Enforcement ingestion endpoints (**`/api/v1/enforcement/check`**, **`baselines`**, **`accept`**) accept **only** **`schema_version` 3**. **`POST /accept`** additionally requires **`acceptance_reason`** and **`acceptance_owner`** (trimmed non-empty strings), optional **`evidence_links`** (HTTPS URLs, capped count/length per server validation), and optional **`exception_review_by`** (RFC3339 / ISO-8601 instant strictly after server `now` at parse time, or **400**).

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

- **`outcome_certificate`** MUST satisfy **`schemas/outcome-certificate-v3.schema.json`** (**`schemaVersion` 3**, required **`evidenceCompleteness`**; failed current producers must include `evidenceCompleteness.remediationItems` and `rerunPath`).
- Legacy payloads naming **`outcome_certificate_v1`** or **`schema_version` 2** return **400** with a stable **`detail`** string (documented in OpenAPI).

Server recomputes both hashes from canonical bytes and rejects mismatches.

## Migration and cutover

- Existing baselines without evidence are marked `needs_rebaseline=true`.
- `check` returns `ENFORCE_BASELINE_REBASE_REQUIRED` until baseline is recreated with v3 evidence envelopes.
- First successful `--create-baseline` or `--accept-drift` clears `needs_rebaseline` and binds `baseline_evidence_id`.

## Shared visibility and export

- Read-only UI: `/account/governance`.
- Export endpoint: `GET /api/v1/governance/export` returns **`GovernanceAuditBundleV3`** JSON (**breaking:** **`schemaVersion: 3` only**) with lifecycle, baseline, FSM transitions (each may include nested **`governedAcceptance`** when transition metadata references an acceptance id), events, and an **`evidenceSlices`** map (keys = **`governance_evidence.id`**; each value holds the stored **Outcome Certificate v3**, fingerprints, **`hostedExit`**, completeness, **`truthCheckVerdict`**). Wire shape matches OpenAPI **`#/components/schemas/GovernanceAuditBundleV3`**. It is **not** the forensic **technical run bundle** directory from **`--write-run-bundle`**; for full NDJSON/engine artifacts plus an on-disk decision bundle, use the CLI as in **[`decision-evidence-bundle.md`](decision-evidence-bundle.md)**.

### Export integrity failures

Any referenced **`governance_evidence`** row that fails Outcome Certificate v3 validation or whose stored fingerprints disagree with **`canonicalCertificateSha256` / `materialTruthSha256`** yields **HTTP 500** with **`CORRUPTED_EVIDENCE_ROW`** (no degraded export — operators fix storage or rollback).

## Removed surfaces

- Projection-hash governance authority (`src/enforcementProjection.ts`).
- Orphan enforce lock orchestration exports in `src/cli/lockOrchestration.ts`.
