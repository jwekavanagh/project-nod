# Reconciliation vocabulary (canonical)

**Single implementation source:** [`src/reconciliationPresentation.ts`](../src/reconciliationPresentation.ts) exports stable dimension IDs, HTML `<th>` titles, stderr line prefixes, batch **`formatBatchObservedStateSummary`**, and Quick **`buildQuickUnitReconciliation`**. **Do not** duplicate these strings in product code outside that module and tests.

**Trust boundary** for this table matches [What this does **not** prove](verification-product-ssot.md#what-this-does-not-prove-trust-boundary) in [`verification-product-ssot.md`](verification-product-ssot.md): **observed** is snapshot SQL ground truth, not proof of execution.

| Dimension ID (`data-etl-dimension`, Quick `units[].reconciliation` keys) | Human title (trust panel `<th>`) | Stderr / human line prefix (exact) | Batch JSON fields (per truth step) | Quick JSON (per unit) |
|--------------------------------------------------------------------------|----------------------------------|------------------------------------|--------------------------------------|-------------------------|
| `declared` | Declared | `declared: ` | `toolId`, `intendedEffect.narrative`, `observedExecution.paramsCanonical` (stderr packs these into one line; see [`agentskeptic.md` — Human truth report](agentskeptic.md#human-truth-report)) | `reconciliation.declared` |
| `expected` | Expected | `expected: ` | `verifyTarget` (`null` → sentinel in stderr) | `reconciliation.expected` |
| `observed_database` | Observed (database) | `observed_database: ` | **`observedStateSummary`** (required, **`schemaVersion` 9**) | `reconciliation.observed_database` |
| `verification_verdict` | Verification verdict | `verification_verdict: ` | `outcomeLabel`, human phrase, optional `failureCategory` (stderr packs into one line) | `reconciliation.verification_verdict` |
