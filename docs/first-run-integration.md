# First-run integration (SSOT)

**Python verification SSOT:** Collapsed integrator narrative (LangGraph tables, `verify()` entrypoint, TypeScript pointer) lives in [`integrator-verification.md`](integrator-verification.md). This file remains the **npm / adoption spine** checklist.

Checklist anchors: **PatternComplete**, **AdoptionComplete_PatternComplete**, **AC-TRUST-01**, **AC-OPS-01**, **IntegrateSpineComplete**.

<!-- epistemic-contract:consumer:first-run-integration -->
**Epistemic framing (pointer only):** Normative epistemic definitions live only in [`epistemic-contract.md`](epistemic-contract.md). Operational four-way model, Decision-ready ProductionComplete, and commercial verdict semantics: [`adoption-epistemics.md`](adoption-epistemics.md).

**Throughput (operator, pointer only):** Metric SQL and ids: [`growth-metrics.md`](growth-metrics.md). Interpretation and proxies: [`epistemic-contract.md`](epistemic-contract.md). User outcome vs telemetry capture: [`funnel-observability.md`](funnel-observability.md). **Decision-ready ProductionComplete:** [`adoption-epistemics.md#decision-ready-productioncomplete-normative`](adoption-epistemics.md#decision-ready-productioncomplete-normative).
<!-- /epistemic-contract:consumer:first-run-integration -->

## First five minutes (browser, CLI join, verify)

The canonical numbered checklist, privacy summary for anonymous surface impressions, and “telemetry is optional icing” framing are rendered in-app on beacon-eligible pages at **`#agentskeptic-first-five-minutes`** (for example **[integrate](https://agentskeptic.com/integrate#agentskeptic-first-five-minutes)**). Authoritative strings live only in **`src/firstFiveMinutesChecklist.ts`**; CI rejects pasting those lines verbatim into `docs/**/*.md`.

Prerequisite framing: [README wedge](../README.md#buy-vs-build-why-not-only-sql-checks).

```bash
npm start
```

## Step 1: Install, build, and run the bundled demo

Aligns with the activation shell through **`npm start`** (contrast **`wf_complete`** vs **`wf_missing`** / **`ROW_ABSENT`** on the seeded demo DB).

```bash
npm install
npm run build
npm start
```

## Step 2: Run first-run-verify (AdoptionComplete_PatternComplete)

Runs the repo's scripted first-run checks after the demo.

```bash
npm run first-run-verify
```

**Partner quickstart (commands SSOT):** Copy-paste **`npm run partner-quickstart`**, optional Postgres wiring, and the LangGraph reference block are maintained only in [partner-quickstart-commands.md](partner-quickstart-commands.md). Boundaries for LangGraph-shaped emitters vs repository truth are normative in [`langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md#langgraph-reference-documentation-boundaries).

## Step 3: Bootstrap pack and verify `wf_bootstrap_fixture`

Mid-spine: materialize the bootstrap pack, then contract-verify against a **temp copy** of the demo DB (`$ADOPT_DB` in the shell; see [`integrate-activation-shell.bash`](../scripts/templates/integrate-activation-shell.bash)). Uses **`node dist/cli.js bootstrap`** with **`test/fixtures/bootstrap-pack/input.json`**, then **`wf_bootstrap_fixture`** with the emitted **`events.ndjson`** / **`tools.json`**.

```bash
OUT="$(mktemp -u "${TMPDIR:-/tmp}/agentskeptic-integrate-mid-XXXXXXXX")"
ADOPT_DB="$(mktemp)"
node dist/cli.js bootstrap --input test/fixtures/bootstrap-pack/input.json --db examples/demo.db --out "$OUT"
cp examples/demo.db "$ADOPT_DB"
node dist/cli.js --workflow-id wf_bootstrap_fixture --events "$OUT/events.ndjson" --registry "$OUT/tools.json" --db "$ADOPT_DB"
```

## Step 4: Integrator DB guard and crossing (IntegrateSpineComplete)

The full L0 script **exit code is 0** iff every step completes, including the **final** `node dist/cli.js bootstrap … --input examples/integrate-your-db/bootstrap-input.json` and the following **`crossing`** pack-led on `"$AGENTSKEPTIC_VERIFY_DB"` (same event/registry/db flags as contract batch verify; integrator-owned gate per [`agentskeptic.md`](agentskeptic.md) Integrator-owned gate; final-phase telemetry matches **`verify_integrator_owned`** per [`crossing-normative.md`](crossing-normative.md)).

**Authority:** integrator lifecycle, trust gating, telemetry, and CI replay live in **[`docs/decision-gate.md`](decision-gate.md)**.

Commercial follow-ups: Stripe billing, `AGENTSKEPTIC_API_KEY`, `POST /api/v1/usage/reserve`.
