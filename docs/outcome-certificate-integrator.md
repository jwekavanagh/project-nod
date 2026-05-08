# Outcome Certificate — CLI and share

Library integration (`createDecisionGate`, NDJSON replay): **[`docs/decision-gate.md`](decision-gate.md)**.
Commercial governance semantics (material truth hash, baseline lifecycle, shared governance UI, audit export) are in **[`docs/governance.md`](governance.md)**.

**Hosted enforce API (`POST /api/v1/enforcement/check|baselines|accept`):** governance evidence bodies use **`schema_version` 3** with **`outcome_certificate`** (inner Outcome Certificate **`schemaVersion` 3**, including **`evidenceCompleteness`** and **`failureSpine`**; optional **`correctnessDefinition`** when emitted). Response payloads continue to expose lifecycle fields per OpenAPI (**`EnforcementFsmEnvelopeV2`**). Authoritative behavior is **`docs/outcome-certificate-normative.md`** — section **Hosted enforcement lifecycle (verification FSM)** — not inferred from legacy `enforcement_events.event` strings.

## Strict validator pins (consumer migration)

Consumers who compile or pin **exact bytes** of [`https://agentskeptic.com/schemas/outcome-certificate-v3.schema.json`](https://agentskeptic.com/schemas/outcome-certificate-v3.schema.json) (or a fork) with **`additionalProperties: false`** at the certificate root will **reject** payloads that add new optional keys until that pinned schema file is updated and redeployed. Emitters may send superset JSON first; strict validators must **repin** the canonical schema URL when adopting optional fields such as **`correctnessDefinition`** or additive **`evidenceCompleteness.remediationItems[]`** / **`evidenceCompleteness.rerunPath`** keys.

## Retaining decision evidence

Use **`--write-decision-bundle`** for a portable directory (outcome certificate, exit, human-layer, manifest; optional attestation / next-action). See **[`decision-evidence-bundle.md`](decision-evidence-bundle.md)**. **`--write-run-bundle`** is the separate **technical run bundle** (events + workflow result + manifest).

## CLI (batch contract verify)

- **stdout:** one JSON line — **Outcome Certificate v3** (**`schemas/outcome-certificate-v3.schema.json`**).
- **stderr:** **`truth_check_verdict:`** then **`release_critical_truth_check_verdict:`** (contract primary path), then **`humanReport`** (includes anchored **`=== evidence_completeness ===`** … **`=== end evidence_completeness ===`** block) plus distribution footer lines (when not `--no-human-report`) — ordering details: **[`docs/integrate.md`](integrate.md)**. Failed current certificates render **`Remediation items:`** under those anchors; each item has **`Failed check:`**, **`Expected state:`**, **`Automation:`**, and **`Rerun:`** lines.
- **Exit codes:** `0` = `matches_expectations`; `1` = `does_not_match`; `2` = `not_established`; `3` = operational error.
- **LangGraph checkpoint trust:** pass **`--langgraph-checkpoint-trust`** for the same argv shape; stdout is always one Outcome Certificate with **`runKind: "contract_sql_langgraph_checkpoint_trust"`** (see [`langgraph-checkpoint-trust.md`](langgraph-checkpoint-trust.md)). **Ineligible** LangGraph runs never enter the standard batch verify runner (certificate-only path: no database, no engine reconciliation). Generic verify without the flag exits **`3`** with empty stdout if the file contains **v3** `tool_observed` lines for the selected workflow.

## CLI (quick verify)

- **stdout:** one JSON line — **Outcome Certificate v3** (**`schemas/outcome-certificate-v3.schema.json`**) with `runKind: "quick_preview"` for quick flows.
- **stderr:** anchored quick rollup block **and** completeness anchors for operator-facing narration.

`QuickVerifyReport` remains an internal quick-processing/report structure. User-facing CLI automation should parse the emitted Outcome Certificate JSON on stdout; quick human-report anchor guidance remains in **`docs/quick-verify-normative.md`** (`formatQuickVerifyHumanReport`).

## Share (`POST /api/public/verification-reports`)

Body must be **v3** only:

```json
{ "schemaVersion": 3, "certificate": { /* OutcomeCertificateV3 */ } }
```

Legacy **v2** POST bodies return **400**. Response: **`{ "schemaVersion": 3, "id": "<uuid>", "url": "https://…/r/<uuid>" }`**.

## semver note (breaking)

Removing the legacy **`formatDecisionBlockerForHumans`** export is a **MAJOR** semver change for **`agentskeptic`** (`5.x`): consumers should read **`certificate.evidenceCompleteness`** JSON and anchored stderr instead of importing six-line formatters.

## Remediation consumption

Treat **`evidenceCompleteness.remediationItems[]`** as the complete convergence list. **`nextActions[]`** remains a primary summary for older consumers and compact display. Rerun guidance is conditional, for example **`Rerun verify after downstream state matches the expected state.`** or **`Rerun verify with the same inputs after the read-only prerequisite is restored.`**

If **`humanReview.required`** is true, do not apply automated writes; show **`humanReview.decisionPrompt`** and inspect the listed hypotheses/facts before changing state or inputs. Automation class **`read_only_retry`** permits only read-only verification retry with the same inputs after the read prerequisite is restored; other classes require external input repair, external state repair, or manual judgment.

## Licensing

Subscription and `POST /api/v1/usage/reserve` gate **running** licensed verify; they do **not** add fields to the certificate. See [`commercial.md`](commercial.md).

Licensed **`POST /api/v1/funnel/verify-outcome`** requires **`schema_version` 3** plus **`evidence_gap_primary`** (mirror of **`evidenceCompleteness.blockerCategory`** at emission time).
