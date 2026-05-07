# Integrator verification

The **canonical integrator guide** — first-run CLI/SDK flow, previews, proofs, governance pointers — lives in **[`docs/integrate.md`](integrate.md)**.

This document holds the **generated capability matrix** (below) plus the authoritative **LangGraph checkpoint trust** subsection. For certificate field meanings and **`runKind`** semantics site-wide, see **[`docs/outcome-certificate-normative.md`](outcome-certificate-normative.md)** and **[`docs/outcome-certificate-integrator.md`](outcome-certificate-integrator.md)**.

<a id="langgraph-checkpoint-trust"></a>

## LangGraph checkpoint trust

Checkpoint trust verifies **persisted orchestration checkpoints** alongside **registry-backed SQL** so a LangGraph-shaped run cannot claim alignment from trace narrative alone.

### Objective

Produce the same deterministic **Outcome Certificate v3** contract as **`agentskeptic check`**, but with **`runKind: contract_sql_langgraph_checkpoint_trust`**, **`checkpointVerdicts`** on eligible runs, and shared kernel wiring (`verifyRunStateFromBufferedRunEvents`, `createLangGraphCheckpointTrustGate` in **`src/langGraphCheckpointTrustGate.ts`**).

### Eligibility

For the selected **`workflowId`**, every buffered **`tool_observed`** event considered for checkpoint trust **must**:

- Validate as a **`tool_observed`** NDJSON row.
- Carry **`schemaVersion: 3`** (mixed or **`schemaVersion`**-missing **`tool_observed`** rows make the workflow **ineligible** with reason such as **`LANGGRAPH_CHECKPOINT_TRUST_NON_V3_TOOL_OBSERVED`**).
- Include structured **`langgraphCheckpoint`** payloads consistent with emitter contracts (ordering and strict emitter rules for Node reference tooling: **[`scripts/lib/langgraphReferenceVerifyCore.mjs`](../scripts/lib/langgraphReferenceVerifyCore.mjs)**, **`test/langgraph-reference-emitter-before-cli-spawn.test.mjs`**).

**Ineligible runs** terminate in a certificate-only outcome (no database verification passes); see **[`docs/outcome-certificate-integrator.md`](outcome-certificate-integrator.md)** (checkpoint trust bullet).

Generic **`agentskeptic check`** without **`--langgraph-checkpoint-trust`** against v3 **`tool_observed`** input for that workflow exits **`3`** with empty stdout (product guardrail).

### Minimum CLI path

Authoritative shell snippets (SQLite and Postgres parity) live in **`docs/partner-quickstart-commands.md`** — use the **`--langgraph-checkpoint-trust`** variants of **`agentskeptic check`** with the **`examples/partner-quickstart/partner.events.ndjson`** + **`partner.tools.json`** pairing.

Regression driver (CI only, not consumer quickstart): **`scripts/langgraph-reference-verify.mjs`** (see **[`docs/langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md)**).

### Minimum Python-first path

Run **[`examples/python-verification/README.md`](../examples/python-verification/README.md)** (**`run_partner_kernel_demo.py`**, Postgres optional). Direct kernel helpers (e.g. **`verify_langgraph_checkpoint_trust`**) reuse the same policy as CLI.

### User-visible outcome

| Stream | Contents |
|--------|----------|
| **stdout** | One **`Outcome Certificate v3`** JSON object with **`schemaVersion: 3`**; eligible runs include **`checkpointVerdicts`** after SQL reconciliation. **`runKind`** is **`contract_sql_langgraph_checkpoint_trust`**. |
| **stderr** | Leading **`truth_check_verdict: trusted|not_trusted|unknown`**, then human report (**`humanReport`** / evidence completeness anchors) unless **`--no-human-report`**. |
| **Exit codes** | **`0`** = **`matches_expectations`**; **`1`** = **`does_not_match`**; **`2`** = **`not_established`**; **`3`** = operational / usage errors. Details: **[`docs/outcome-certificate-integrator.md`](outcome-certificate-integrator.md)**. |

Canonical **`highStakesReliance`** derivation for this **`runKind`**: **[`docs/outcome-certificate-normative.md`](outcome-certificate-normative.md)** (derivation table).

### Production irreversibility gate

**`assertLangGraphCheckpointProductionGate(certificate)`** (SDK / hosting) allows progression only when the certificate already reflects **successful SQL alignment**, **checkpoint verdict rollup fully verified**, **`trustDecision` safe**, **`highStakesReliance: permitted`** — the **`lgRowBPasses`** invariant in **`src/langGraphCheckpointTrustGate.ts`**. Intended for gating irreversible commits (deploy, ledger movement) after checkpoint trust—not a substitute for covering every branching path that needs a human risk review.

### Preview vs enforced contract

| **Mode** | **Notes** |
|---|---|
|**`agentskeptic quick`**|Infer SQL-only previews; **`runKind: quick_preview`**; **`highStakesReliance: prohibited`**; no checkpoint trust path (see **`docs/quick-verify-normative.md`**).|
|**`agentskeptic check`** + **`--langgraph-checkpoint-trust`**|Authoritative bounded multi-step truth with checkpoint rollup + SQL (**this section**).|
|**`agentskeptic enforce`**|Stateful baselines and drift (**commercial** lifecycle). See **`docs/ci-enforcement.md`** and **`docs/commercial-enforce-gate-normative.md`**.|

### Related tests & boundaries

Terminal-outcome regressions: [`test/langgraph-checkpoint-trust-terminal.contract.test.mjs`](../test/langgraph-checkpoint-trust-terminal.contract.test.mjs). Oracle vs Python primacy narrative: [`docs/langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md).

<!-- GENERATED_CAPABILITY_MATRIX_START -->

## Generated Capability Matrix

| Behavior | Capability | TS | Python |
| --- | --- | --- | --- |
| `bigquery.sql_row.strong` | `unsupported` | `supported` | `supported` |
| `http_witness.strong` | `supported` | `supported` | `supported` |
| `mongo_document.strong` | `supported` | `supported` | `supported` |
| `mysql.sql_row.strong` | `unsupported` | `supported` | `supported` |
| `object_storage_object.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_effects.eventual` | `supported` | `supported` | `supported` |
| `postgres.sql_effects.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_relational.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_row_absent.strong` | `supported` | `supported` | `supported` |
| `postgres.sql_row.bounded` | `supported` | `supported` | `supported` |
| `postgres.sql_row.eventual` | `supported` | `supported` | `supported` |
| `postgres.sql_row.strong` | `supported` | `supported` | `supported` |
| `sqlite.sql_row_absent.strong` | `supported` | `supported` | `supported` |
| `sqlite.sql_row.bounded` | `unsupported` | `supported` | `supported` |
| `sqlite.sql_row.eventual` | `supported` | `supported` | `supported` |
| `sqlite.sql_row.strong` | `supported` | `supported` | `supported` |
| `sqlserver.sql_row.strong` | `unsupported` | `supported` | `supported` |
| `vector_document.strong` | `supported` | `supported` | `supported` |

<!-- GENERATED_CAPABILITY_MATRIX_END -->
