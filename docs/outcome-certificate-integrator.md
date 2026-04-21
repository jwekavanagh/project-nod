# Outcome Certificate — CLI and share

Library integration (`createDecisionGate`, NDJSON replay): **[`docs/decision-gate-ssot.md`](decision-gate-ssot.md)**.

## CLI (batch contract verify)

- **stdout:** one JSON line — Outcome Certificate v1.
- **stderr:** human report string (`humanReport`) plus distribution footer lines (when not `--no-human-report`).
- **Exit codes:** `0` = `matches_expectations`; `1` = `does_not_match`; `2` = `not_established`; `3` = operational error.

## CLI (quick verify)

- **stdout:** Outcome Certificate v1 with `runKind: "quick_preview"` (always `highStakesReliance: "prohibited"`).

## Share (`POST /api/public/verification-reports`)

Body must be **v2** only:

```json
{ "schemaVersion": 2, "certificate": { /* OutcomeCertificateV1 */ } }
```

Response: `{ "schemaVersion": 2, "id": "<uuid>", "url": "https://…/r/<uuid>" }`.

## Licensing

Subscription and `POST /api/v1/usage/reserve` gate **running** licensed verify; they do **not** add fields to the certificate. See [`commercial-ssot.md`](commercial-ssot.md).
