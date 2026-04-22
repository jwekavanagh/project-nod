# LangGraph checkpoint trust — product SSOT

This document is the **single source of truth** for LangGraph **checkpoint-scoped** contract verification: wire shape, terminal behavior, shared kernel, and how it differs from generic `contract_sql` batch verify.

## Wire (v3 only)

LangGraph checkpoint trust consumes **`schemaVersion: 3`** `tool_observed` lines only. Each line **must** include **`langgraphCheckpoint`** with **`threadId`**, **`checkpointNs`**, and **`checkpointId`**. Schema: [`schemas/event.schema.json`](../schemas/event.schema.json).

## Shared kernel

There is **one** implementation of buffered events → **`WorkflowResult`**: **`verifyRunStateFromBufferedRunEvents`** in [`src/verifyRunStateFromBufferedRunEvents.ts`](../src/verifyRunStateFromBufferedRunEvents.ts).

- **`createDecisionGate`** (`evaluate` / `evaluateCertificate`) calls this module after buffering.
- **`createLangGraphCheckpointTrustGate`**: **`runCheckpointTrust()`** calls it on the **eligible** path only. The **ineligible** path returns an Outcome Certificate from [`validatedLangGraphIneligibleCertificate`](../src/langGraphCheckpointTrustIneligibleCertificate.ts) and **never** opens a database or invokes the verify pipeline.

## Batch CLI (A2 short-circuit)

For **ineligible** LangGraph checkpoint trust, [`runBatchVerifyWithTelemetrySubcommand`](../src/verify/batchVerifyTelemetrySubcommand.ts) builds the certificate and runs telemetry + stdout **without** entering **`runStandardVerifyWorkflowCliToTerminalResult`** (so no `WorkflowResult`, no bundle write, and no `stderrAppendBeforeStdout` hook). **Eligible** LangGraph runs still use that runner after **`verifyRunStateFromBufferedRunEvents`**.

## Eligibility (LangGraph mode only)

**Eligible** iff, after loading the file into the same buffer + `runLevelReasons` as generic batch verify:

1. `runLevelReasons.length === 0`, and  
2. There is at least one schema-valid `tool_observed` for the target `workflowId`, and  
3. Every such line has **`schemaVersion === 3`**.

Otherwise the run is **ineligible**: **no SQL** and **no database connection** (certificate-only path), one Outcome Certificate on stdout with **`runKind: "contract_sql_langgraph_checkpoint_trust"`**, **`steps: []`**, **`checkpointVerdicts` omitted**, **`stateRelation: "not_established"`**, CLI exit **2**, stderr headline **`LangGraph checkpoint trust: ineligible`** (exact substring).

Pure function: **`classifyLangGraphCheckpointTrustEligibility`** in [`src/langGraphCheckpointTrustGate.ts`](../src/langGraphCheckpointTrustGate.ts).

## Terminal contract (summary)

| Row | Mode | stdout | SQL | `runKind` | `checkpointVerdicts` | Exit |
|-----|------|--------|-----|-----------|----------------------|------|
| **A1** | Generic verify **without** `--langgraph-checkpoint-trust`; file has v3 `tool_observed` for workflow | empty | No | n/a | n/a | **3** |
| **A2** | LangGraph mode; ineligible | one JSON | No | `contract_sql_langgraph_checkpoint_trust` | omitted | **2** |
| **B** | LangGraph; eligible; engine complete; all checkpoint rollups verified | one JSON | Yes | same | present, all `verified` | **0** |
| **C** | LangGraph; eligible; DB mismatch | one JSON | Yes | same | present | **1** |
| **D** | LangGraph; eligible; engine incomplete | one JSON | Yes | same | present (may include `incomplete`) | **2** |

## Production wedge

**`assertLangGraphCheckpointProductionGate(certificate)`** (package export) succeeds **only** on row **B** (matches expectations, high-stakes permitted, non-empty **`checkpointVerdicts`**, every verdict **`verified`**). Otherwise it throws **`LangGraphCheckpointTrustUnsafeError`** with the same six-line human shape as **`DecisionUnsafeError`**.

Generic irreversible gating remains **`assertSafeForIrreversibleAction`** on the decision gate ( **`DecisionUnsafeError`** ).

## CLI

- **`--langgraph-checkpoint-trust`** on bare batch verify: LangGraph certificate contract on stdout for every outcome (including A2).
- Without the flag, if the events file contains any **v3** `tool_observed` for **`--workflow-id`**, the CLI exits **3** with **empty stdout** (A1).

## CI elimination proof

**`node scripts/assert-no-langgraph-v1-product-path.mjs`** runs in **`npm test`** immediately after **`node scripts/langgraph-reference-verify.mjs`**. It fails if a v1 LangGraph product path reappears in the reference emitter, verify core, or the LangGraph section of generated partner commands.

## Related SSOT

- Decision gate vs batch: [`decision-gate-ssot.md`](decision-gate-ssot.md)  
- Outcome Certificate fields and `highStakesReliance`: [`outcome-certificate-normative.md`](outcome-certificate-normative.md)  
- LangGraph **documentation** boundaries (not behavior): [`langgraph-reference-boundaries-ssot.md`](langgraph-reference-boundaries-ssot.md)
