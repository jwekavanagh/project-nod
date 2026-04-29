# Outcome Certificate — CLI and share

Library integration (`createDecisionGate`, NDJSON replay): **[`docs/decision-gate.md`](decision-gate.md)**.
Commercial governance semantics (material truth hash, baseline lifecycle, shared governance UI, audit export) are in **[`docs/governance.md`](governance.md)**.

## CLI (batch contract verify)

- **stdout:** one JSON line — Outcome Certificate v1.
- **stderr:** human report string (`humanReport`) plus distribution footer lines (when not `--no-human-report`).
- **Exit codes:** `0` = `matches_expectations`; `1` = `does_not_match`; `2` = `not_established`; `3` = operational error.
- **LangGraph checkpoint trust:** pass **`--langgraph-checkpoint-trust`** for the same argv shape; stdout is always one Outcome Certificate with **`runKind: "contract_sql_langgraph_checkpoint_trust"`** (see [`langgraph-checkpoint-trust.md`](langgraph-checkpoint-trust.md)). **Ineligible** LangGraph runs never enter the standard batch verify runner (certificate-only path: no database, no engine reconciliation). Generic verify without the flag exits **`3`** with empty stdout if the file contains **v3** `tool_observed` lines for the selected workflow.

## CLI (quick verify)

- **stdout:** Outcome Certificate v1 with `runKind: "quick_preview"` (always `highStakesReliance: "prohibited"`).

## Share (`POST /api/public/verification-reports`)

Body must be **v2** only:

```json
{ "schemaVersion": 2, "certificate": { /* OutcomeCertificateV1 */ } }
```

Response: `{ "schemaVersion": 2, "id": "<uuid>", "url": "https://…/r/<uuid>" }`.

## Licensing

Subscription and `POST /api/v1/usage/reserve` gate **running** licensed verify; they do **not** add fields to the certificate. See [`commercial.md`](commercial.md).
