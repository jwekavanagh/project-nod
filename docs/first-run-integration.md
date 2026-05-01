# First-run integration (SSOT)

The v2 integrator **SSOT** is [`integrate.md`](integrate.md). This file keeps the ordered adoption checklist, historical spine anchors, and commercial references for in-repo contract tests.

**Wedge / scar context (read first):** [Buy vs build (README)](../README.md#buy-vs-build-why-not-only-sql-checks).

Search token (tests): README.md#buy-vs-build-why-not-only-sql-checks

## Step 1: Run the local demo

```bash
npm start
```

**Commercial (hosted / licensed npm):** billing may use **Stripe**; set **`AGENTSKEPTIC_API_KEY`**; the license service uses **`POST /api/v1/usage/reserve`** before metered runs.

<!-- epistemic-contract:consumer:first-run-integration -->
**Epistemic framing (pointer only):** Normative epistemic definitions live only in [`epistemic-contract.md`](epistemic-contract.md). Operational four-way model, Decision-ready ProductionComplete, and commercial verdict semantics: [`adoption-epistemics.md`](adoption-epistemics.md).

**Throughput (operator, pointer only):** Metric SQL and ids: [`growth-metrics.md`](growth-metrics.md). Interpretation and proxies: [`epistemic-contract.md`](epistemic-contract.md). User outcome vs telemetry capture: [`funnel-observability.md`](funnel-observability.md). **Decision-ready ProductionComplete:** [`adoption-epistemics.md#decision-ready-productioncomplete-normative`](adoption-epistemics.md#decision-ready-productioncomplete-normative).
<!-- /epistemic-contract:consumer:first-run-integration -->

**Checklist IDs (naming from adoption spec):** **PatternComplete**, **AdoptionComplete_PatternComplete**, **AC-TRUST-01**, **AC-OPS-01**, **IntegrateSpineComplete**.

**Default path (operator):** [README default path](../README.md#default-path-decisiongate-before-you-act)

**Migrate:** [`migrate-2.md`](migrate-2.md)

## Step 2: Contract batch (`first-run-verify`)

```bash
npm run first-run-verify
```

**Partner quickstart (copy-paste commands SSOT):** [partner-quickstart-commands.md](partner-quickstart-commands.md) — `npm run partner-quickstart`, Postgres, LangGraph oracle, and integrator-owned gate examples. LangGraph-shaped emitters vs repo truth: [`langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md#langgraph-reference-documentation-boundaries).

## Step 3: Fixture activation and `wf_bootstrap_fixture`

The activation shell uses a temp `--out` and a copied DB (`$ADOPT_DB`). From the repo directory it prepends `dirname("$INTEGRATE_SPINE_NODE")` to `PATH` (validator pins Node on Windows; see `scripts/templates/integrate-activation-shell.bash`), then runs **`node dist/cli.js`** for activate, bare batch, and crossing. Mid-script equivalents:

`node dist/cli.js activate --input test/fixtures/bootstrap-pack/input.json --db examples/demo.db --out "$OUT"`  
then `node dist/cli.js --workflow-id wf_bootstrap_fixture --events "$OUT/events.ndjson" --registry "$OUT/tools.json" --db "$ADOPT_DB"`.

**Normative (activate / bootstrap):** **[bootstrap-pack-normative.md](bootstrap-pack-normative.md)** (flags, **`--out`** staging, exit table, **`proof/`**, **`activation.manifest.json`**). Integrator-facing summary with HTTP mirrors: **[integrate.md#activation](integrate.md#activation)**.

## Step 4: Optional integrate spine and crossing

On your integrator database, run **activate** and the pack-led **crossing** for `wf_integrate_spine` (see [crossing-normative.md](crossing-normative.md) and **`scripts/templates/integrate-activation-shell.bash`**). Pack layout and **`activate`** exits for the **`examples/integrate-your-db/`** bootstrap input remain **[bootstrap-pack-normative.md](bootstrap-pack-normative.md)**.

---

The full L0 script **exit code is 0** iff every step completes, including the **final** `node dist/cli.js activate … --input examples/integrate-your-db/bootstrap-input.json` and **`node dist/cli.js crossing …`** against `"$AGENTSKEPTIC_VERIFY_DB"` (same event/registry/db flags as contract batch verify; integrator-owned gate per [`agentskeptic.md`](agentskeptic.md) Integrator-owned gate; final-phase telemetry matches **`verify_integrator_owned`** per [`crossing-normative.md`](crossing-normative.md)).
