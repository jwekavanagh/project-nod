# Governance SSOT

This document is the single source of truth for commercial governance.

## Model

- **GovernanceEvidence**: immutable evidence row containing `outcome_certificate_v1`, `certificate_sha256`, `material_truth_v1`, and `material_truth_sha256`.
- **GovernanceBaseline**: per `(user_id, workflow_id)` pointer to an accepted evidence revision.
- **GovernanceEvent**: append-only transition row (`baseline_created`, `check_pass`, `drift_detected`, `drift_accepted`) with an evidence reference.

## Material truth

Material truth is the deterministic projection from `OutcomeCertificateV1` validated by `schemas/material-truth-v1.schema.json`. Drift compares only `material_truth_sha256`.

## Quick trust boundary

- `runKind=quick_preview` can participate in governance lifecycle.
- Quick evidence is always `reliance_class=provisional`.
- Contract SQL evidence is `reliance_class=eligible`.

## API contract

Enforcement endpoints accept a v2 evidence request:

```json
{
  "schema_version": 2,
  "run_id": "string",
  "workflow_id": "string",
  "outcome_certificate_v1": {},
  "material_truth_sha256": "string",
  "certificate_sha256": "string"
}
```

Server recomputes both hashes and rejects mismatches.

## Migration and cutover

- Existing baselines without evidence are marked `needs_rebaseline=true`.
- `check` returns `ENFORCE_BASELINE_REBASE_REQUIRED` until baseline is recreated with v2 evidence.
- First successful `--create-baseline` or `--accept-drift` clears `needs_rebaseline` and binds `baseline_evidence_id`.

## Shared visibility and export

- Read-only UI: `/account/governance`.
- Export endpoint: `GET /api/v1/governance/export`.

## Removed surfaces

- Projection-hash governance authority (`src/enforcementProjection.ts`).
- Orphan enforce lock orchestration exports in `src/cli/lockOrchestration.ts`.
