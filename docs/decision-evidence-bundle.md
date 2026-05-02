# Decision evidence bundle (operational SSOT)

Normative definitions of **ProductionComplete**, artifacts **A1–A5**, and adoption checks remain in [`adoption-epistemics.md`](adoption-epistemics.md). This document defines how **operational retention** maps to portable JSON files for reviewers and CI.

## Terminology

| Name | Purpose |
|------|---------|
| **Technical run bundle** | `--write-run-bundle`: `events.ndjson`, `workflow-result.json`, `agent-run.json` (optional signing). For reproduction and engine debugging. |
| **Decision evidence bundle** | `--write-decision-bundle`: outcome certificate, exit record, human-layer, manifest, optional attestation / next-action. For audit and decision retention without shell redirection. |

## Directory layout

Written only when **`--write-decision-bundle <dir>`** is passed (opt-in).

| File | Role |
|------|------|
| `outcome-certificate.json` | A1 — [`OutcomeCertificateV2`](../schemas/outcome-certificate-v2.schema.json) |
| `exit.json` | A2 — exit code convention `outcome_certificate_v2` (CLI stdout certificate schema generation) |
| `human-layer.json` | A3 — human report text or `suppressed` when `--no-human-report` |
| `attestation.json` | Optional A4 — [`decision-evidence-attestation-v1`](../schemas/decision-evidence-attestation-v1.schema.json) via `--decision-attestation` |
| `next-action.json` | Optional A5 — [`decision-evidence-next-action-v1`](../schemas/decision-evidence-next-action-v1.schema.json) via `--decision-next-action` |
| `manifest.json` | Bundle metadata + **completeness** (explicit `a4Present`, `a5Present`, `a5Required`) |

## Completeness rules

- **`stateRelation`** on the outcome certificate is authoritative (see [`outcome-certificate-normative.md`](outcome-certificate-normative.md)).
- **`a5Required`** is **true** iff `stateRelation` is `does_not_match` or `not_established`; then **`next-action.json`** is required for **`manifest.completeness.status === "complete"`**. Otherwise the bundle may be **partial**.
- **A4** does not gate mechanical **`complete`**; **`a4Present`** is explicit for reviewers. Adoption-level ProductionComplete may still require human attestation per [`adoption-epistemics.md`](adoption-epistemics.md).

## CLI

Batch verify, **verify-integrator-owned**, and **quick** share the same optional flags:

- `--write-decision-bundle <dir>`
- `--decision-attestation <path>`
- `--decision-next-action <path>`

### Validation

```bash
agentskeptic decision-bundle validate <dir>
```

- **Stdout:** exactly **one** JSON line (`kind: decision_bundle_validation`, `schemaVersion: 1`), sorted keys.
- **Exit:** `0` complete, `1` partial, `2` invalid, `3` operational failure.

## Hosted export

`GET /api/v1/governance/export` returns **`schemaVersion: 2`** with **`decisionEvidenceExport`** aligned to this model (see route implementation). CLI exit codes are not stored server-side; **`embedded.exit`** uses **`hosted_not_recorded`**.
