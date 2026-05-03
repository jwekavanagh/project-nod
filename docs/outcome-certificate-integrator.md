# Outcome Certificate — CLI and share

Library integration (`createDecisionGate`, NDJSON replay): **[`docs/decision-gate.md`](decision-gate.md)**.
Commercial governance semantics (material truth hash, baseline lifecycle, shared governance UI, audit export) are in **[`docs/governance.md`](governance.md)**.

**Hosted enforce API (`POST /api/v1/enforcement/check|baselines|accept`):** governance evidence bodies use **`schema_version` 3** with **`outcome_certificate`** (inner Outcome Certificate **`schemaVersion` 3**, including **`evidenceCompleteness`** and **`failureSpine`**; optional **`correctnessDefinition`** when emitted). Response payloads continue to expose lifecycle fields per OpenAPI (**`EnforcementFsmEnvelopeV2`**). Authoritative behavior is **`docs/outcome-certificate-normative.md`** — section **Hosted enforcement lifecycle (verification FSM)** — not inferred from legacy `enforcement_events.event` strings.

## Strict validator pins (consumer migration)

Consumers who compile or pin **exact bytes** of [`https://agentskeptic.com/schemas/outcome-certificate-v3.schema.json`](https://agentskeptic.com/schemas/outcome-certificate-v3.schema.json) (or a fork) with **`additionalProperties: false`** at the certificate root will **reject** payloads that add new optional keys until that pinned schema file is updated and redeployed. Emitters may send superset JSON first; strict validators must **repin** the canonical schema URL when adopting optional fields such as **`correctnessDefinition`** or extra **`evidenceCompleteness`** keys.

## Retaining decision evidence

Use **`--write-decision-bundle`** for a portable directory (outcome certificate, exit, human-layer, manifest; optional attestation / next-action). See **[`decision-evidence-bundle.md`](decision-evidence-bundle.md)**. **`--write-run-bundle`** is the separate **technical run bundle** (events + workflow result + manifest).

## CLI (batch contract verify)

- **stdout:** one JSON line — **Outcome Certificate v2** (**`schemas/outcome-certificate-v2.schema.json`**).
- **stderr:** **`truth_check_verdict:`** line (contract primary path) followed by **`humanReport`** (includes anchored **`=== evidence_completeness ===`** … **`=== end evidence_completeness ===`** block) plus distribution footer lines (when not `--no-human-report`) — ordering details: **[`docs/integrate.md`](integrate.md)**.
- **Exit codes:** `0` = `matches_expectations`; `1` = `does_not_match`; `2` = `not_established`; `3` = operational error.
- **LangGraph checkpoint trust:** pass **`--langgraph-checkpoint-trust`** for the same argv shape; stdout is always one Outcome Certificate with **`runKind: "contract_sql_langgraph_checkpoint_trust"`** (see [`langgraph-checkpoint-trust.md`](langgraph-checkpoint-trust.md)). **Ineligible** LangGraph runs never enter the standard batch verify runner (certificate-only path: no database, no engine reconciliation). Generic verify without the flag exits **`3`** with empty stdout if the file contains **v3** `tool_observed` lines for the selected workflow.

## CLI (quick verify)

- **stdout:** **Quick Verify report** (**`QuickVerifyReport`**, **`schemaVersion` 5**) including the same **`evidenceCompleteness`** object shape as certificates, then (when chaining to certificate paths) adapters may synthesize **`OutcomeCertificate`** v2 carrying that completeness.
- **stderr:** anchored quick rollup block **and** completeness anchors for operator-facing narration.

When **`agentskeptic quick`** emits **`QuickVerifyReport` JSON only**, treat **`humanReport`/anchors** guidance as applying wherever the CLI merges quick human output (`formatQuickVerifyHumanReport`)—see **`docs/quick-verify-normative.md`**.

## Share (`POST /api/public/verification-reports`)

Body must be **v3** only:

```json
{ "schemaVersion": 3, "certificate": { /* OutcomeCertificateV2 */ } }
```

Legacy **v2** POST bodies return **400**. Response: **`{ "schemaVersion": 3, "id": "<uuid>", "url": "https://…/r/<uuid>" }`**.

## semver note (breaking)

Removing the legacy **`formatDecisionBlockerForHumans`** export is a **MAJOR** semver change for **`agentskeptic`** (`5.x`): consumers should read **`certificate.evidenceCompleteness`** JSON and anchored stderr instead of importing six-line formatters.

## Licensing

Subscription and `POST /api/v1/usage/reserve` gate **running** licensed verify; they do **not** add fields to the certificate. See [`commercial.md`](commercial.md).

Licensed **`POST /api/v1/funnel/verify-outcome`** requires **`schema_version` 3** plus **`evidence_gap_primary`** (mirror of **`evidenceCompleteness.blockerCategory`** at emission time).
