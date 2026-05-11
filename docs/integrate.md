# AgentSkeptic integrator guide (v3 SSOT)

**Shortest first-run path:** **[`first-truth-check.md`](first-truth-check.md)** — one page for the default **`agentskeptic check`** flow, inputs, stdout/stderr, CI, and Cursor. This file remains the **full** integrator SSOT below.

**Start here:** run **one stateless contract truth check** with **`agentskeptic check`** (CLI) or **`AgentSkeptic.check`** (TypeScript) — compare structured tool activity to **downstream state** (SQL plus registry-defined HTTP / object / vector / Mongo checks when configured). The default `check` path needs **no API key and no license server**. Read the **Outcome Certificate** on stdout (**v3**, includes **`failureSpine`**, **`evidenceCompleteness`**, **`releaseCriticalVerdict`**, and per-step **`releaseCritical`**) and the stderr machine lines **`truth_check_verdict:`** then **`release_critical_truth_check_verdict:`** (each `trusted|not_trusted|unknown`) — only the first line’s **`trusted`** means the global workflow can be relied on; the second line governs **release-critical** CI when you opt into **`fail-on: critical_not_trusted_or_unknown`** (see **[`docs/ambient-ci-distribution.md`](ambient-ci-distribution.md)**). To diff **two saved** certificates (semantic posture only, no events), use **`agentskeptic compare certificates --before <prior.json> --after <current.json>`** — see **[`docs/agentskeptic.md`](agentskeptic.md#verification-diff-outcome-certificate-v3)**. Naming collisions between certificate **`schemaVersion: 3`** and other numbered artifacts (**receipts**, **trust snapshots**, **`exit.json`**) are spelled out once in **[Trust artifact naming glossary](outcome-certificate-normative.md#trust-artifact-naming-glossary)**—read that glossary before auditing hosted exports side-by-side with CLI bundles. Optional pre-step: **`agentskeptic quick`** for a cheap **SQL-inference preview** on captured activity (provisional, not audit-final).

**Hybrid proof (Postgres):** after `npm run build`, with **`POSTGRES_VERIFICATION_URL`** set, run **`node examples/hybrid-contract-demo.mjs`** — one workflow, one trust line, SQL + local HTTP witness (see [`verification-state-stores.md`](verification-state-stores.md#hybrid-contract-demo)).

Optional accelerator: [/integrate/guided](https://agentskeptic.com/integrate/guided) in the hosted app (this file is the raw integrator SSOT).

The hosted guided page helps you produce local CLI inputs; it does not replace a first quick proof, and registry drafting is optional formalization after you have a meaningful verification outcome.

Hosted trust capture (blocked-decision records + alerts) lives in **[trust-authority-layer.md](trust-authority-layer.md)**.

## Zero-ceremony first pass (quick)

**Goal:** answer “what happened on the wire?” before you invest in registry authoring.

- Run **`agentskeptic quick`** on your capture (SQLite or Postgres) and read **Outcome Certificate v3** stdout (`runKind: "quick_preview"`). The same **`evidenceCompleteness`** shape appears on quick output and on contract certificates — use it for blocker category, missing actionable inputs, **`quickSignal`** (“did SQL verification run meaningfully?” vs ingest/mapping stalls), summary **`nextActions`**, and complete **`remediationItems[]`** when checks fail.
- Human stderr includes the quick anchor block plus the shared **`=== evidence_completeness ===`** section (see **`docs/outcome-certificate-integrator.md`**).
- **Preview boundary:** `quick_preview` stays **`highStakesReliance: prohibited`** and does **not** run non-SQL witnesses; graduate to contract **`check`** below when reviews need decision-grade permission or when expected state spans non-SQL stores.

## Truth check (primary)

<a id="first-truth-check"></a>

### CLI

```bash
npx agentskeptic check --workflow-id YOUR_WORKFLOW_ID \
  --events path/to/events.ndjson \
  --registry path/to/tools.json \
  --db path/to/readable.sqlite
```

With a conventional project layout (paths relative to `--project`):

```bash
npx agentskeptic check --workflow-id YOUR_WORKFLOW_ID \
  --project ./your-repo-root \
  --db path/to/readable.sqlite
```

When using `--project`, defaults are **`./your-repo-root/agentskeptic/tools.json`** and **`./your-repo-root/agentskeptic/events.ndjson`** if `--registry` / `--events` are omitted. **`--workflow-id` is always required** (never inferred).

- **Proof export:** `--proof <dir>` is equivalent to `--write-decision-bundle` (decision evidence bundle; see [decision-evidence-bundle.md](decision-evidence-bundle.md)). **Progressive evidence:** that doc’s ladder is the SSOT—add `--write-run-bundle <dir>` alongside `--write-decision-bundle` when you need both the decision bundle and the technical run bundle on disk. **Hosted** `GET /api/v1/governance/export` returns **`GovernanceAuditBundleV3`** (OpenAPI **`#/components/schemas/GovernanceAuditBundleV3`**) with slice-keyed **`evidenceSlices`** — semantic parity with enforcement certificates and core fingerprints, **not** a replacement for the CLI on-disk bundles or **`--write-run-bundle`** NDJSON (hosted export section in [decision-evidence-bundle.md](decision-evidence-bundle.md)).
- **Full flag reference:** [agentskeptic.md](agentskeptic.md). **Advanced subcommands** (`activate`, `loop`, `quick`, …): `agentskeptic help advanced`.
- **GitHub Actions:** copy **[`examples/github-actions/agentskeptic-check.yml`](../examples/github-actions/agentskeptic-check.yml)** (composite **`./.github/actions/agentskeptic-check`**, wraps **`agentskeptic check`**; pin upstream `OWNER/agentskeptic/.github/actions/agentskeptic-check@REF` externally). The canonical OSS workflow uses **`project: .`** (after creating **`agentskeptic/tools.json`** and **`agentskeptic/events.ndjson`**) and a **single pinned** **`npm install --no-save`** with **`AGENTSKEPTIC_CI_PACKAGE`**, composite **`package: ${{ env.AGENTSKEPTIC_CI_PACKAGE }}`**, so verify and **`render-discovery-ci.mjs`** share one install path. Alternatively pass **`events`** and **`registry`** and leave **`project`** empty (**XOR** with **`project`** — see **`ambient-ci-distribution.md`**). Set **`AGENTSKEPTIC_TELEMETRY=0`** on the gate job for concise stderr. The composite **`package`** default **`agentskeptic@latest`** is a shorthand only; **[release gates pin semver](ambient-ci-distribution.md#composite-package-input-contract-normative)**. Every run uploads **`outcome-certificate.json`** as the **`agentskeptic-outcome-certificate`** artifact, writes a certificate-derived job summary, and exposes structured composite outputs (`state-relation`, `trust-decision`, `release-critical-verdict`, `failing-tool-ids`, `primary-reason-codes`, `failing-witness-kinds`, `recommended-action`, `automation-safe`, `certificate-path`) — full surface in **[`docs/ambient-ci-distribution.md`](ambient-ci-distribution.md)**. The OSS example needs only **`permissions: contents: read`** (the artifact uses `ACTIONS_RUNTIME_TOKEN`, not `GITHUB_TOKEN`). Opt-in commercial **enforcement**: **[`examples/github-actions/agentskeptic-commercial.yml`](../examples/github-actions/agentskeptic-commercial.yml)** or composite **`mode: enforce`** plus commercial secrets (**batch** **`enforce`** accepts **`--project`** like **`check`**) — see **`ambient-ci-distribution.md`**.
- **Cursor local loop (optional):** copy **[`examples/cursor/agentskeptic-check.mdc`](../examples/cursor/agentskeptic-check.mdc)** into your consumer repo rules and run the same `agentskeptic check` contract in agent-assisted coding workflows — see **[`cursor-integration.md`](cursor-integration.md)**.

### stderr: `truth_check_verdict` and `release_critical_truth_check_verdict`

On verdict exits, stderr begins with two machine lines in order:

1. `truth_check_verdict: trusted|not_trusted|unknown`
2. `release_critical_truth_check_verdict: trusted|not_trusted|unknown` (matches certificate **`releaseCriticalVerdict`**)

| Line value | When |
|------------|------|
| `trusted` | `stateRelation` is `matches_expectations` and high-stakes reliance is `permitted` |
| `not_trusted` | Determinate mismatch (`does_not_match`) |
| `unknown` | Incomplete / not established |

Then the human-readable certificate report (unless `--no-human-report`; the verdict lines are still emitted).

<a id="framework-verification-recipes"></a>

## Framework verification recipes

Compact map of supported **narrow** adoption paths; each downstream link owns the runnable detail. AgentSkeptic verifies **structured tool activity against downstream witnesses** (`agentskeptic check`), not exhaustive framework ownership.

Boundaries:

- No AgentSkeptic MCP verification product surface (**Phase 10 decision:** [`docs/rfcs/mcp-verification-tool.md`](rfcs/mcp-verification-tool.md)).
- Optional Python extras (LangGraph checkpoints, CrewAI hooks) defer to **`python/FRAMEWORK_LOCK.md`**; everything else emits NDJSON/registry and uses the OSS CLI/SDK.
- For certificate field truth, **`docs/outcome-certificate-normative.md`** remains authoritative.

Each recipe repeats the scaffold below so you know inputs, outputs, and limits before cloning sample repos.

Recipe scaffold (exact heading names): **`#### Problem`**, **`#### Captured activity`**, **`#### Minimum registry`**, **`#### Command`**, **`#### Expected verdict`**, **`#### Evidence source`**, **`#### CI pointer`**, **`#### Boundary`**.

### Recipe: LangGraph checkpoint trust

#### Problem

Orchestration traces align while persisted checkpoints/SQL drift.

#### Captured activity

v3 **`tool_observed`** NDJSON carrying **`langgraphCheckpoint`** payloads for one **`workflowId`**.

#### Minimum registry

Validated **`agentskeptic/tools.json`** mapping tool effects to verification kinds (SQLite/Postgres per run).

#### Command

CLI: add **`--langgraph-checkpoint-trust`** alongside standard **`agentskeptic check`** args—copy/paste snippets in **`docs/partner-quickstart-commands.md`**.

#### Expected verdict

**`runKind: contract_sql_langgraph_checkpoint_trust`** Outcome Certificate on stdout plus stderr **`truth_check_verdict`** (see **`docs/outcome-certificate-integrator.md`**).

#### Evidence source

Statute:** [`docs/integrator-verification.md#langgraph-checkpoint-trust`](integrator-verification.md#langgraph-checkpoint-trust).

#### CI pointer

**`examples/github-actions/agentskeptic-check.yml`** with **`extra-args`** for **`--langgraph-checkpoint-trust`** when exercising partner fixtures.

#### Boundary

Checkpoint trust rejects mixed schema versions; **`agentskeptic quick`** does not replace this contract path.

### Recipe: Python-first LangGraph/kernel demo

#### Problem

Need in-process parity with OSS certificates before wiring Node tooling.

#### Captured activity

Same partner fixtures mirrored into Python **`VerificationSession`**.

#### Minimum registry

**`examples/partner-quickstart/partner.tools.json`**.

#### Command

Follow **`examples/python-verification/README.md`** (`pip install -e "python/[dev]"`, **`run_partner_kernel_demo.py`**).

#### Expected verdict

Python-emitted certificates remain schema-compatible with CLI stdout JSON.

#### Evidence source

**`examples/python-verification/README.md`**.

#### CI pointer

**`npm run test:python`** (includes LangGraph primacy guard) surfaces regressions locally.

#### Boundary

Demonstration kernel only—production wiring still requires your emitter + registry ownership.

### Recipe: Generic NDJSON / CLI / TypeScript SDK

#### Problem

Any stack can emit **`tool_observed`** shaped rows regardless of orchestration SDK.

#### Captured activity

NDJSON (**`agentskeptic/events.ndjson`**) JSON lines matching event schema validations.

#### Minimum registry

Versioned **`agentskeptic/tools.json`**.

#### Command

Documented in **`docs/first-truth-check.md`** (**`agentskeptic check`** / **`AgentSkeptic.check`** examples).

#### Expected verdict

Trusted vs not-trusted vs unknown per stderr line + **`stateRelation`** in stdout JSON (**`Outcome Certificate v3`**).

#### Evidence source

**`docs/first-truth-check.md`** and `stdout`/`stderr` contract above.

#### CI pointer

**`examples/github-actions/agentskeptic-check.yml`** (composite action).

#### Boundary

Structured ingest only—raw log scraping remains out of scope (see ingest guidance in **`docs/quick-verify-normative.md`** for previews).

### Recipe: Cursor agent-assisted verification

#### Problem

Local coding agents must replay the contract inside editor loops.

#### Captured activity

Same NDJSON/registry layout as Generic recipe.

#### Minimum registry

Per-project **`tools.json`** with stable **`toolId` → verification** mappings.

#### Command

Adopt **`examples/cursor/agentskeptic-check.mdc`** guidance + **`docs/cursor-integration.md`**.

#### Expected verdict

Identical **`truth_check_verdict`** semantics as CLI (rules drive **`npx agentskeptic check`**, not MCP).

#### Evidence source

**`docs/cursor-integration.md`** + **`examples/cursor/agentskeptic-check.mdc`**.

#### CI pointer

Mirror the YAML composite in **`examples/github-actions/agentskeptic-check.yml`** for merge gates outside Cursor.

#### Boundary

Hosted MCP verification surface remains deferred (**[`docs/rfcs/mcp-verification-tool.md`](rfcs/mcp-verification-tool.md)**).

### Recipe: CrewAI minimal hook

#### Problem

Demonstrate bridging CrewAI tool hooks into the verifier without maintaining a heavyweight integration layer.

#### Captured activity

Hook-buffered **`tool_observed`** payloads via **`crewai.hooks.before_tool_call`** (see **`python/FRAMEWORK_LOCK.md`**).

#### Minimum registry

Partner SQLite fixtures mirrored in **`examples/partner-quickstart`**.

#### Command

**`examples/python-verification/README.md#crewai-minimal-example`** (pip extra **`crewai`**, **`crewai_minimal.py`**).

#### Expected verdict

**`trustDecision` / certificate JSON** aligning with OSS CLI semantics (**`agentskeptic check`** equivalents).

#### Evidence source

**`python/FRAMEWORK_LOCK.md`**, **`examples/python-verification/README.md`**.

#### CI pointer

Optional: wrap **`crewai_minimal.py`** invocation in nightly automation when extras installed.

#### Boundary

Pins only **`crewai` hook surface enumerated in FRAMEWORK_LOCK**—not full Crew lifecycle ownership.

### Recipe: OpenAI-style tool loop (SQL-only contract truth)

#### Problem

Assistant transcript shows tool success strings while relational state disagrees.

#### Captured activity

Structured **`tool_calls` → tool_observed** ingestion (manual or SDK), not unstructured chat logs.

#### Minimum registry

Row-level relational expectations authored per tool.

#### Command

Operational narrative + symptoms:** **[https://agentskeptic.com/guides/tool-loop-success-crm-state-wrong](https://agentskeptic.com/guides/tool-loop-success-crm-state-wrong)**; raw Markdown: **[https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/website/content/surfaces/guides/tool-loop-success-crm-state-wrong.md](https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/website/content/surfaces/guides/tool-loop-success-crm-state-wrong.md)**.

#### Expected verdict

**`ROW_ABSENT`** / mismatch codes surface once SQL truth diverges—even if conversational UI looked successful.

#### Evidence source

Site guide linked above plus generic contract docs (**`docs/integrate.md`**, **`docs/first-truth-check.md`**).

#### CI pointer

Reuse **`examples/github-actions/agentskeptic-check.yml`** replaying emitted NDJSON snapshots.

#### Boundary

Hybrid HTTP/object/vector witnessing requires remote DB URL + registry kinds—stay on SQL-first until infra matches **`docs/verification-state-stores.md`**.

### Recipe: Postgres HTTP hybrid witness

#### Problem

Demonstrate simultaneous SQL + **`http_witness`** checks from one contract run beyond pure LangGraph checkpoints.

#### Captured activity

Temporarily generated NDJSON/registry pairing produced by scripted demo (**`examples/hybrid-contract-demo.mjs`**).

#### Minimum registry

Registry rows composing SQL + **`http_witness`** kinds as described in **`docs/verification-state-stores.md`**.

#### Command

`npm run build` then **`POSTGRES_VERIFICATION_URL=… node examples/hybrid-contract-demo.mjs`** (details in **`docs/verification-state-stores.md#hybrid-contract-demo`**).

#### Expected verdict

Trusted multi-step **`Outcome Certificate`** verifying both Postgres rows and ephemeral HTTP fixtures.

#### Evidence source

**`docs/verification-state-stores.md#hybrid-contract-demo`**.

#### CI pointer

Optional workflow step mirroring Postgres URL secret + scripted demo for staging environments.

#### Boundary

Demonstration script—not a packaged integration; remote DB + witness prerequisites apply (SQLite file cannot host HTTP witnesses).

### Receipt side effect

`agentskeptic check` and `agentskeptic quick` write one verification receipt JSON per run under `artifacts/agentskeptic-receipts/` (fail-closed on receipt write/schema errors with exit 3).

### TypeScript SDK

```bash
npm install agentskeptic
```

```typescript
import { AgentSkeptic } from "agentskeptic";
import { join } from "node:path";

const skeptic = new AgentSkeptic({
  registryPath: join(process.cwd(), "agentskeptic", "tools.json"),
  databaseUrl: process.env.DATABASE_URL ?? join(process.cwd(), "demo.db"),
});

// Replay agentskeptic/events.ndjson (same layout as CLI check)
const certificate = await skeptic.check({ workflowId: "wf_main" });

// Or verify live observations without composing gate + emitter by hand:
const live = await skeptic.check({
  workflowId: "wf_main",
  observations: [
    { toolId: "crm.upsert_contact", params: { recordId: "c1", fields: { name: "Alice", status: "active" } } },
  ],
});
```

**Next.js App Router** (minimal POST using the primary API):

```typescript
import { AgentSkeptic } from "agentskeptic";
import { join } from "node:path";

const skeptic = new AgentSkeptic({
  registryPath: join(process.cwd(), "agentskeptic", "tools.json"),
  databaseUrl: process.env.DATABASE_URL!,
});

export async function POST(req: Request) {
  const body = (await req.json()) as {
    workflowId?: string;
    observations?: Array<{ toolId: string; params: Record<string, unknown> }>;
  };
  const certificate = await skeptic.check({
    workflowId: body.workflowId ?? "api",
    observations: body.observations ?? [],
  });
  return Response.json(certificate);
}
```

For middleware-wrapped handlers that construct a gate per request, **`createNextRouteHandler`** from **`agentskeptic/next`** remains available (advanced composition); prefer **`check`** for the default integration path above.

Raw event objects on low-level replay surfaces remain supported for compatibility.

### Production reference (Next.js + Postgres)

For a **full executable reference app** (deployable stack, deterministic pass/fail), use [golden-path.md](golden-path.md). That path is **production onboarding**, not the minimum first truth check.

## Advanced

Everything beyond **`check`** / **`AgentSkeptic.check`** is optional depth: activation packs, crossing, loop, quick verify, CI enforce, LangGraph checkpoint trust, and compatibility positional batch verify. Discover via **`agentskeptic help advanced`** and [agentskeptic.md](agentskeptic.md).

<!-- epistemic-contract:consumer:first-run-integration -->
**Epistemic framing (pointer only):** Normative epistemic definitions live only in [`epistemic-contract.md`](epistemic-contract.md). Operational four-way model, Decision-ready ProductionComplete, and commercial verdict semantics: [`adoption-epistemics.md`](adoption-epistemics.md).

**Throughput (operator, pointer only):** Metric SQL and ids: [`growth-metrics.md`](growth-metrics.md). Interpretation and proxies: [`epistemic-contract.md`](epistemic-contract.md). User outcome vs telemetry capture: [`funnel-observability.md`](funnel-observability.md). **Decision-ready ProductionComplete:** [`adoption-epistemics.md#decision-ready-productioncomplete-normative`](adoption-epistemics.md#decision-ready-productioncomplete-normative).
<!-- /epistemic-contract:consumer:first-run-integration -->

## Adoption checklist (operator)

**Wedge / scar context (read first):** [Buy vs build (README)](../README.md#buy-vs-build-why-not-only-sql-checks).

**Checklist IDs:** **PatternComplete**, **AdoptionComplete_PatternComplete**, **AC-TRUST-01**, **AC-OPS-01**, **IntegrateSpineComplete**.

**Default path (operator):** [README default path](../README.md#default-path-one-truth-check)

**Migrate:** [`migrate-2.md`](migrate-2.md)

### Step 1: Run the local demo

```bash
npm start
```

**Commercial (hosted / licensed npm):** billing may use **Stripe**; set **`AGENTSKEPTIC_API_KEY`**; the license service uses **`POST /api/v1/usage/reserve`** before metered runs.

### Step 2: Contract batch (`first-run-verify`)

```bash
npm run first-run-verify
```

**Partner quickstart (copy-paste commands SSOT):** [partner-quickstart-commands.md](partner-quickstart-commands.md) — `npm run partner-quickstart`, Postgres, LangGraph oracle, and integrator-owned gate examples. LangGraph-shaped emitters vs repo truth: [`langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md#langgraph-reference-documentation-boundaries).

### Step 3: Fixture activation and `wf_bootstrap_fixture`

The activation shell uses a temp `--out` and a copied DB (`$ADOPT_DB`). From the repo directory it prepends `dirname("$INTEGRATE_SPINE_NODE")` to `PATH` (validator pins Node on Windows; see `scripts/templates/integrate-activation-shell.bash`), then runs **`node dist/cli.js`** for activate, batch verify, and crossing. Mid-script equivalents:

`node dist/cli.js activate --input test/fixtures/bootstrap-pack/input.json --db examples/demo.db --out "$OUT"`  
then `node dist/cli.js check --workflow-id wf_bootstrap_fixture --events "$OUT/events.ndjson" --registry "$OUT/tools.json" --db "$ADOPT_DB"`.

**Normative (activate / bootstrap):** **[bootstrap-pack-normative.md](bootstrap-pack-normative.md)** (flags, **`--out`** staging, exit table, **`proof/`**, **`activation.manifest.json`**).

### Step 4: Optional integrate spine and crossing

On your integrator database, run **activate** and the pack-led **crossing** for `wf_integrate_spine` (see [crossing-normative.md](crossing-normative.md) and **`scripts/templates/integrate-activation-shell.bash`**). Pack layout and **`activate`** exits for the **`examples/integrate-your-db/`** bootstrap input remain **[bootstrap-pack-normative.md](bootstrap-pack-normative.md)**.

<a id="integrate-spine-normative"></a>

The full L0 script **exit code is 0** iff every step completes, including the **final** `node dist/cli.js activate … --input examples/integrate-your-db/bootstrap-input.json` and **`node dist/cli.js crossing …`** against `"$AGENTSKEPTIC_VERIFY_DB"` (same event/registry/db flags as contract batch verify; integrator-owned gate per [`agentskeptic.md`](agentskeptic.md) Integrator-owned gate; final-phase telemetry matches **`verify_integrator_owned`** per [`crossing-normative.md`](crossing-normative.md)).

## Exportable activation and packs (advanced)

Canonical CLI: **`agentskeptic activate`** with the same flags as **`agentskeptic bootstrap`** (`--input`, `--db` or `--postgres-url`, `--out`) and **`BootstrapPackInput` v1** JSON ([bootstrap-pack-normative.md](bootstrap-pack-normative.md)).

On contract-terminated exits (**0 / 1 / 2**), **`activate`** writes **`${out}/proof/run/`**, **`${out}/proof/decision/`**, and **`${out}/proof/activation.manifest.json`**, emits three **`AGENTSKEPTIC_ACTIVATION …`** stderr lines (before any human certificate stderr on terminal verify), and (commercial npm) **`POST`s** verify-outcome with **`subcommand: "activate"`** and required nested **`activation`** mirroring the disk manifest (**snake_case** on the wire).

**Legacy:** **`agentskeptic bootstrap`** runs the same `executeBootstrapPack` kernel with inner license preflight only; it never emits **`proof/`**, manifest, machine activation lines, or verify-outcome **`activation`** payloads. Migrate scripts to **`activate`** for exportable activation evidence.

**Stage ids (shared vocabulary):** `ingest_input`, `provisional_infer`, `contract_verify`, `proof_export`.

**Trust labels:** `n_a`, `provisional_pass`, `decision_ready`, `contract_inconsistent`, `contract_incomplete`.

Quick-path bootstrap failures (**quick ≠ pass**, no exportable tools, empty **`tool_calls`**, pack write failures) emit a single **`AGENTSKEPTIC_ACTIVATION stage=provisional_infer trust_terminal=blocked`** line for **`activate`**, then the existing bootstrap JSON **`stderr`** envelope (no **`proof/`**).

HTTP contract (reference): [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml) — **`VerifyOutcomeRequestV3.activation`** ( **`schema_version` 3**, required **`evidence_gap_primary`**).

Disk manifest schema: [`schemas/activation-manifest-v1.schema.json`](../schemas/activation-manifest-v1.schema.json).

## Product shape

- **Truth kernel**: compare declared tool effects to read-only stored state; one `WorkflowResult` / `OutcomeCertificate` path.
- **Commercial activation** (npm commercial build / hosted): HTTP contract in [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml); TypeScript types are generated (`openapi-typescript`) and consumed by a **hand-written** client (`src/sdk/transport.ts`). There is **no** generated runtime SDK.

## Python (PyPI)

### Install

```bash
pip install "agentskeptic[crewai,langgraph]"  # extras optional
```

### Scaffold

```bash
python -m agentskeptic init --framework none --database sqlite --yes
```

### SDK surface

- `AgentSkeptic` — [`python/src/agentskeptic/sdk.py`](../python/src/agentskeptic/sdk.py)
- `verify()` context manager — deprecated in favor of `AgentSkeptic.verify()`; emits `DeprecationWarning` once per process unless `AGENTSKEPTIC_SUPPRESS_DEPRECATION=1`.
- **Frameworks**: CrewAI and LangGraph pins are documented in [`python/FRAMEWORK_LOCK.md`](../python/FRAMEWORK_LOCK.md). AutoGen integration was **removed** in 2.0.

## Errors

Cross-language code list: `schemas/agentskeptic-error-codes.json` (synced to `python/src/agentskeptic/agentskeptic_error_codes.json`).

## Migration

See [`docs/migrate-2.md`](migrate-2.md) and run `agentskeptic migrate [path]` (TypeScript) to list deprecated call sites.

## Further reading

- CLI reference: [`docs/agentskeptic.md`](agentskeptic.md)
- Crossing contract (advanced batch path): [`docs/crossing-normative.md`](crossing-normative.md)
