# Python verification (partner contract)

This folder is the **Python-first** LangGraph / kernel demo surface. Commands for the Node reference emitter remain in the generated partner quickstart; this README stays prose-only per repo drift rules.

**Canonical integrator guide:** [`docs/integrate.md`](../../docs/integrate.md). **LangGraph checkpoint trust statute** (including capability matrix): [`docs/integrator-verification.md#langgraph-checkpoint-trust`](../../docs/integrator-verification.md#langgraph-checkpoint-trust).

Run the kernel demo (requires repo root `examples/partner-quickstart` fixtures):

```bash
pip install -e "python/[dev]"
python examples/python-verification/run_partner_kernel_demo.py
```

**Postgres (same certificates as the Node CLI):** install **`pip install -e "python/[dev,postgres]"`** and set **`database_url` to a connection string** (e.g. `postgresql://user:pass@localhost:5432/mydb`) on **`VerificationSession`**. For direct kernel use, import **`verify_langgraph_checkpoint_trust`** from **`agentskeptic.kernel`** and pass that URL. Apply the same `partner.seed.sql` (or your schema) to the target database for parity with the partner quickstart.

## CrewAI minimal example

Deterministic, in-process demo: shows where the pinned CrewAI hook surface (**`crewai.hooks.before_tool_call`**) is attached during **`AgentSkeptic.verify(framework="crewai")`** (via **`agentskeptic._integrations.crewai.attach_crewai`**), how buffered tool observations flow into the same contract-SQL verification kernel used elsewhere, and prints an **Outcome Certificate** JSON. Authority for pins and hook path: [`python/FRAMEWORK_LOCK.md`](../../python/FRAMEWORK_LOCK.md).

```bash
pip install -e "python/[dev,crewai]"
python examples/python-verification/crewai_minimal.py
```

No LLM or API keys; uses the same **`examples/partner-quickstart`** SQLite seed and **`partner.tools.json`** as the LangGraph demo above.

If CrewAI is not installed, the script exits non-zero with a short message (no traceback).

**Reading the certificate:** the JSON includes **`trustDecision`**: **`safe`**, **`unsafe`**, or **`unknown`**, plus **`stateRelation`**, **`highStakesReliance`**, and **`relianceRationale`**. The embedded human-oriented report uses wording such as **TRUSTED** / **NOT TRUSTED** / ineligible paths—align machine fields with that narrative when integrating.
