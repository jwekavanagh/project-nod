# Integrator verification (SSOT)

This document is the **default landing page** for how to integrate AgentSkeptic: one collapsed story for Python (in-process kernel, no Node on the verification hot path) and a compact TypeScript pointer for npm customers. Normative LangGraph checkpoint-trust tables live **once** here; older filenames remain short redirects.

## Why this shape

Python agents should not depend on a second language runtime to prove database truth. The **`agentskeptic`** PyPI package transliterates the same buffered-event → read-only SQL → **Outcome Certificate** pipeline as the TypeScript kernel, exposes a **single** public entrypoint **`verify()`** (context manager), and validates wire JSON against the same repo schemas. The npm CLI remains for TypeScript integrators and for **CI parity** against frozen goldens until oracle demotion.

## Python default path

Install from the repository (PyPI publishing is wired in CI when tags are cut):

```bash
pip install -e "python/[dev]"
```

Public surface is intentionally tiny: import **`verify`**, **`emit_tools_json`**, and the typed errors **`AgentSkepticError`**, **`DecisionUnsafeError`**, **`LangGraphCheckpointTrustUnsafeError`** from `agentskeptic` only.

### LangGraph checkpoint trust (API)

Use **`framework="langgraph"`** inside **`with agentskeptic.verify(...):`**. That sets LangGraph certificate mode internally (so **A1** mis-invocation against a v3-only buffer cannot happen through the generic batch flag). The kernel matches the TS **`verifyRunStateFromBufferedRunEvents`** semantics for eligibility (**A2** ineligible → certificate only, no DB), terminal exit codes, and **`runKind: contract_sql_langgraph_checkpoint_trust`**.

Minimal **kernel-level** demo (no hand-written NDJSON files; events built in Python): **`examples/python-verification/run_partner_kernel_demo.py`** with fixtures under **`examples/partner-quickstart/`**.

### CrewAI and AutoGen

Hook surfaces and pinned versions are **normative** in **`python/FRAMEWORK_LOCK.md`**. CrewAI uses tool hooks; AutoGen integration may still raise **`NotImplementedError`** until the observer path is completed—treat as experimental behind extras.

### R5: `tools.json` without hand-authored SQL (common case)

```python
from agentskeptic import emit_tools_json

# Map callables → schema-valid registry entries (see python/tests/test_emit_registry.py)
emit_tools_json([your_callable], path="tools.json")
```

## TypeScript path (npm)

TypeScript integrators keep **`npm install agentskeptic`** and **`createDecisionGate`** / batch **`node dist/cli.js`** as today. Do **not** duplicate normative tables here beyond the LangGraph summary below; event and registry schemas remain under **`schemas/`**, and detailed npm-only topics stay in **`docs/agentskeptic.md`** and generated **`docs/partner-quickstart-commands.md`**.

## LangGraph checkpoint trust {#langgraph-checkpoint-trust}

### Wire (v3 only)

LangGraph checkpoint trust consumes **`schemaVersion: 3`** lines whose **`type`** is structured tool observation (same as TS **`tool_observed`** wire). Each eligible line **must** include **`langgraphCheckpoint`** with **`threadId`**, **`checkpointNs`**, and **`checkpointId`**. Schema: [`schemas/event.schema.json`](../schemas/event.schema.json).

### Shared truth

- **TypeScript:** **`verifyRunStateFromBufferedRunEvents`** in [`src/verifyRunStateFromBufferedRunEvents.ts`](../src/verifyRunStateFromBufferedRunEvents.ts).
- **Python:** `agentskeptic.kernel.verify_sqlite` (SQLite sync path; Postgres port is optional / behind extras).

### Batch / CLI (A2 short-circuit)

For **ineligible** LangGraph checkpoint trust, batch verify builds the certificate and prints telemetry **without** opening a database or entering the full reconcile pipeline. **Eligible** runs still execute read-only SQL after buffering.

### Eligibility (LangGraph mode only)

**Eligible** iff, after loading events into the same buffer + `runLevelReasons` as generic batch verify:

1. `runLevelReasons.length === 0`, and  
2. There is at least one schema-valid v3 tool observation for the target `workflowId`, and  
3. Every such line has **`schemaVersion === 3`**.

Otherwise the run is **ineligible**: **no SQL** and **no database connection** (certificate-only path), one Outcome Certificate on stdout with **`runKind: "contract_sql_langgraph_checkpoint_trust"`**, **`steps: []`**, **`checkpointVerdicts` omitted**, **`stateRelation: "not_established"`**, CLI exit **2**, stderr headline **`LangGraph checkpoint trust: ineligible`** (exact substring).

### Terminal contract (summary)

| Row | Mode | stdout | SQL | `runKind` | `checkpointVerdicts` | Exit |
|-----|------|--------|-----|-----------|----------------------|------|
| **A1** | Generic verify **without** `--langgraph-checkpoint-trust`; file has v3 tool lines for workflow | empty | No | n/a | n/a | **3** |
| **A2** | LangGraph mode; ineligible | one JSON | No | `contract_sql_langgraph_checkpoint_trust` | omitted | **2** |
| **B** | LangGraph; eligible; engine complete; all checkpoint rollups verified | one JSON | Yes | same | present, all `verified` | **0** |
| **C** | LangGraph; eligible; DB mismatch | one JSON | Yes | same | present | **1** |
| **D** | LangGraph; eligible; engine incomplete | one JSON | Yes | same | present (may include `incomplete`) | **2** |

### Production wedge

**`assertLangGraphCheckpointProductionGate(certificate)`** (TS package export) succeeds **only** on row **B**. Otherwise it throws **`LangGraphCheckpointTrustUnsafeError`** with the same six-line human shape as **`DecisionUnsafeError`**.

## Audiences

- **Engineer / integrator:** start with **`examples/python-verification/`**, **`python/README.md`**, and **`python/FRAMEWORK_LOCK.md`**.  
- **Operator:** partner automation remains **`npm run partner-quickstart`** (see generated commands doc).  
- **Reviewer / security:** grep gates — no **`subprocess`** in `python/src/agentskeptic/**`; parity goldens under **`python/tests/parity_vectors/`**; kernel port map **`python/KERNEL_PORT_MAP.md`**.

## Related SSOT

- LangGraph **documentation** boundaries (authority matrix): [`langgraph-reference-boundaries-ssot.md`](langgraph-reference-boundaries-ssot.md)  
- Decision gate vs batch: [`decision-gate-ssot.md`](decision-gate-ssot.md)  
- Outcome Certificate fields: [`outcome-certificate-normative.md`](outcome-certificate-normative.md)
