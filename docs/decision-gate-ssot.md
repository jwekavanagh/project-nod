# Decision gate — integrator SSOT (v2)

This document is the **single source of truth** for in-process verification, trust gating before irreversible actions, run bundles, and how they relate to batch replay, the CLI, and commercial telemetry. Normative product behavior that is not repeated here remains in [`docs/agentskeptic.md`](agentskeptic.md) (event schema, CLI contracts, corpus layout, signing).

## One kernel

All paths that produce a **`WorkflowResult`** from persisted tool observations share **`verifyRunStateFromEvents`** in `pipeline.ts` (also used by **`verifyWorkflow`** on NDJSON files). There is no second reconciliation engine for the same inputs.

Buffered in-process paths share **`verifyRunStateFromBufferedRunEvents`** in `verifyRunStateFromBufferedRunEvents.ts`: **`createDecisionGate.evaluate()`** / **`evaluateCertificate()`** call it after buffering (no duplicate `prepareWorkflowEvents` + verify sequence elsewhere).

- **Batch / CI:** `await verifyWorkflow({ workflowId, eventsPath, registryPath, database, … })`.
- **Runtime:** `createDecisionGate({ workflowId, registryPath, databaseUrl, … })` → **`appendRunEvent`** per tool → **`await gate.evaluate()`** (or **`evaluateCertificate()`**).
- **LangGraph checkpoint trust (runtime):** `createLangGraphCheckpointTrustGate` — **`runCheckpointTrust()`** returns **`OutcomeCertificateV1`** with **`runKind: "contract_sql_langgraph_checkpoint_trust"`**; the **eligible** path uses the same shared **`verifyRunStateFromBufferedRunEvents`** as the decision gate. **Ineligible** runs are certificate-only (no `WorkflowResult`, no DB). Irreversible production gating uses **`assertLangGraphCheckpointProductionGate`** (throws **`LangGraphCheckpointTrustUnsafeError`** when not row B). See [`langgraph-checkpoint-trust-ssot.md`](langgraph-checkpoint-trust-ssot.md).

**Parity expectation:** For the same `workflowId`, registry bytes, database, verification policy, and ordered `tool_observed` events, **`gate.evaluate()`** must match **`verifyWorkflow`** on an NDJSON file containing exactly those lines in the same order (modulo non-`tool_observed` lines, which the gate ignores for SQL verification the same way batch preparation does).

## `createDecisionGate` (canonical runtime API)

Import from the package root: `import { createDecisionGate } from "agentskeptic"`.

| Method | Role |
|--------|------|
| **`appendRunEvent(value)`** | Accepts one [event line](agentskeptic.md#event-line-schema). Non-objects or schema-invalid objects append a run-level **`MALFORMED_EVENT_LINE`** reason (same semantics as a bad NDJSON line in batch). Wrong `workflowId` is ignored. |
| **`toNdjsonUtf8()`** | Returns capture-order NDJSON bytes (`JSON.stringify(event) + "\n"` per buffered line) for CI replay or **`writeRunBundleFromDecisionGate`**. |
| **`evaluate()`** | `Promise<WorkflowResult>` — full stdout-shaped result including **`workflowTruthReport`**. |
| **`evaluateCertificate()`** | `Promise<OutcomeCertificateV1>` — derived from the workflow result (see [`outcome-certificate-normative.md`](outcome-certificate-normative.md)). |
| **`assertSafeForIrreversibleAction()`** | `Promise<void>` — throws **`DecisionUnsafeError`** when the certificate is not safe for high-stakes reliance; message body is exactly **`formatDecisionBlockerForHumans`** (six lines). |

**`databaseUrl`:** Either a filesystem path (SQLite, resolved relative to `projectRoot`) or a `postgres://` / `postgresql://` URL. **`verificationPolicy`** supports **`strong`** and **`eventual`** the same as batch verify.

## Run bundles

After **`await gate.evaluate()`**, persist a canonical bundle with **`writeRunBundleFromDecisionGate`** (`agentRunBundle.ts`): pass **`eventsNdjson: gate.toNdjsonUtf8()`**, the **`workflowResult`** from **`evaluate()`**, optional Ed25519 signing. Corpus validation and Debug Console behavior are unchanged — see **`docs/agentskeptic.md`** (agent run record, signing).

## `verifyAgentskeptic` (NDJSON convenience)

**`verifyAgentskeptic`** loads events for a workflow from disk and returns an **`OutcomeCertificateV1`**. It is implemented with **`loadEventsForWorkflow`**, **`createDecisionGate`**, and **`evaluateCertificate()`** — not a separate verifier. Prefer **`createDecisionGate`** for runtime integration; use **`verifyAgentskeptic`** when you already have an NDJSON file and only need a certificate.

## Trust and human blockers

- **`trustDecisionFromCertificate(certificate)`** → structured trust decision for UI and policy (`trustDecision.ts`).
- **`DecisionUnsafeError`** wraps blocker text from **`formatDecisionBlockerForHumans`** (`decisionUnsafeError.ts`, `decisionBlocker.ts`).

## Telemetry — verify-outcome beacon v2 {#telemetry}

Commercial **`licensed_verify_outcome`** funnel metadata and the verify-outcome beacon body are **v2-only**. The beacon carries **`certificate`**, derived **`trust_decision`**, **`reason_codes`**, and **`workflow_id`** (see `verifyOutcomeBeaconBody.ts` and website **`funnelVerifyOutcome.contract.ts`**). **v1** bodies are rejected by the hosted route.

**Coordinated deploy:** ship **website** route + metadata schema **before or with** CLI / library versions that POST v2-only bodies, so older servers are not overwhelmed by payloads they cannot parse.

## Where to go next

- Event line schema and step semantics: [`docs/agentskeptic.md`](agentskeptic.md).
- CLI stdout/stderr/exit codes and quick vs contract runs: [`docs/agentskeptic.md`](agentskeptic.md) and [`docs/quick-verify-normative.md`](quick-verify-normative.md).
- Outcome certificate fields: [`docs/outcome-certificate-normative.md`](outcome-certificate-normative.md).
- CLI-only share path for certificates: [`docs/outcome-certificate-integrator.md`](outcome-certificate-integrator.md).
