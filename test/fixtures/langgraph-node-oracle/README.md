# LangGraph Node oracle emitter (CI fixture)

This package is **not** an integrator quickstart. It is a minimal LangGraph graph that writes **one** NDJSON line for **`npm test`** / `langgraph-reference-verify` (emitter contract + CLI regression). **Python integrators** should start from [`examples/python-verification/README.md`](../../../examples/python-verification/README.md) and [`docs/integrator-verification.md`](../../../docs/integrator-verification.md).

The line is **`schemaVersion: 3`** with **`langgraphCheckpoint`**, targeting the partner contract (`wf_partner`, `crm.upsert_contact`). Shell commands for CI live in the generated [partner-quickstart-commands.md](../../../docs/partner-quickstart-commands.md) under **LangGraph reference (emit events, then verify)** (Node path for regression only).

**Checkpoint trust behavior** (terminal table, eligibility, production gate): canonical anchors in [`docs/integrator-verification.md`](../../../docs/integrator-verification.md#langgraph-checkpoint-trust).

**Product documentation boundaries** are defined only in [langgraph-reference-boundaries.md](../../../docs/langgraph-reference-boundaries.md#langgraph-reference-documentation-boundaries). Do not duplicate the authority matrix here.
