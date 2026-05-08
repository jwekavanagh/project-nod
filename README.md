<!-- discovery-readme-title:start -->
# AgentSkeptic — state vs trace
<!-- discovery-readme-title:end -->

<!-- discovery-acquisition-fold:start -->
## Trust reality, not traces.

Tool effects vs read-only store facts.

Traces can show success while stored data disagrees.

AgentSkeptic re-checks the stores your agent claims to change, then returns a deterministic Outcome Certificate before you ship.

### Bundled terminal proof

```text
### Success (`wf_complete`) — canonical `agentskeptic check`

stderr (first line): truth_check_verdict: trusted
stdout (Outcome Certificate excerpt): {"schemaVersion":3,"workflowId":"wf_complete","runKind":"contract_sql","stateRelation":"matches_expectations"}

### Failure (`wf_missing`)

stderr (first line): truth_check_verdict: not_trusted
Human report then explains ROW_ABSENT (missing downstream row vs registry expectation).
stdout (Outcome Certificate excerpt): {"schemaVersion":3,"workflowId":"wf_missing","runKind":"contract_sql","stateRelation":"does_not_match"}
```

[How it works](https://agentskeptic.com/database-truth-vs-traces)
<!-- discovery-acquisition-fold:end -->

<!-- adoption-canonical:start -->
## Default path: one truth check

**Start here:** **[`docs/first-truth-check.md`](docs/first-truth-check.md)** — canonical first-run steps (command, inputs, stdout/stderr, CI, Cursor, troubleshooting).

Compare recorded tool activity to downstream state (SQL and, in contract mode, HTTP witnesses, object storage, vectors, Mongo per your registry) and get **Outcome Certificate v3** on stdout (**`schemaVersion: 3`**, **`failureSpine`**, **`evidenceCompleteness`**) plus a **`truth_check_verdict`** line on stderr ([**Trust artifact naming glossary**](docs/outcome-certificate-normative.md#trust-artifact-naming-glossary) explains receipts and decision-bundle `exit.json` naming):

```bash
npx agentskeptic check --workflow-id wf_example \
  --project ./path/to/your-app \
  --db ./path/to/readable.sqlite
```

With the conventional layout, **`--registry`** and **`--events`** default to **`./path/to/your-app/agentskeptic/tools.json`** and **`events.ndjson`**. Pass them explicitly when your paths differ. Shortest path: [`docs/first-truth-check.md`](docs/first-truth-check.md). Full integrator SSOT: [`docs/integrate.md`](docs/integrate.md).

**No license required.** The default `agentskeptic check` path needs no `AGENTSKEPTIC_API_KEY` and no license server; it runs stateless contract verification locally. (Stateful **`agentskeptic enforce`** for baselines, drift, and acceptance is a later opt-in commercial path — see below.)

**Reading the result.** stdout is one **Outcome Certificate v3** line (machine JSON as above). On verdict exits, stderr begins with one of:

```text
truth_check_verdict: trusted
truth_check_verdict: not_trusted
truth_check_verdict: unknown
```

| Verdict | Meaning |
|---------|---------|
| `trusted` | Checked outcome matched expected downstream state — only this verdict means the workflow can be relied on. |
| `not_trusted` | Determinate mismatch or required state missing. Do not claim verified; fix the mismatch. |
| `unknown` | Evidence incomplete or not established. Do not claim verified; collect missing evidence or narrow checked scope. |

Full verdict and stderr contract: [`docs/first-truth-check.md`](docs/first-truth-check.md) (details in [`docs/integrate.md`](docs/integrate.md#first-truth-check)).

**Exportable activation (advanced):** `BootstrapPackInput` v1 + **`agentskeptic activate`** (writes **`proof/`** under **`--out`** on exits 0–2; **`bootstrap`** is legacy — [`docs/bootstrap-pack-normative.md`](docs/bootstrap-pack-normative.md)).

### Lifecycle

1. Keep **`agentskeptic/tools.json`** in version control; update when `toolId` → verification mapping changes.
2. Emit observations via the canonical SDK emitter, then append emitted rows to the gate buffer. Optionally mirror the same JSON lines to **`agentskeptic/events.ndjson`** for CI replay.
3. On the code path **before** irreversible work you control (ship, bill, ticket close), call **`await gate.assertSafeForIrreversibleAction()`** so **unsafe** trust (or required emissions that never reached the gate) blocks **that** branch — it is not a substitute for wiring the gate everywhere it matters, and outcomes can still be **`unknown`** when **`highStakesReliance`** is not **`permitted`** (see [`docs/outcome-certificate-normative.md`](docs/outcome-certificate-normative.md)).

### Install

```bash
npm install agentskeptic
```

### Network access (OSS CLI)

Local contract verification (for example **SQLite file** `--db`) runs **offline by default**: anonymous **product-activation telemetry** is **disabled** unless you opt in with **`AGENTSKEPTIC_TELEMETRY=1`** or persist **`{"telemetry": true}`** in **`~/.agentskeptic/config.json`**. Use **`AGENTSKEPTIC_TELEMETRY=0`** to force telemetry off. When enabled, the CLI sends best-effort anonymous usage events to AgentSkeptic’s telemetry endpoint (**`POST /api/funnel/product-activation`**); it does **not** send workflow payloads, database contents, credentials, prompts, traces, or verification artifacts. Outbound access can still occur when you explicitly configure **remote databases**, **`--share-report-origin`**, state witnesses (**HTTP / vector / S3 / Mongo**), **commercial** license or enforcement flows (**`AGENTSKEPTIC_API_KEY`**), **`funnel-anon pull`**, or when running the **`website/`** app (Stripe, email, databases, etc.).

### Code

```bash
npx agentskeptic init --framework none --database sqlite --yes
```

```ts
import { join } from "node:path";
import { AgentSkeptic } from "agentskeptic";

const skeptic = new AgentSkeptic({
  registryPath: join("agentskeptic", "tools.json"),
  databaseUrl: join(process.cwd(), "demo.db"),
});

const certificate = await skeptic.check({
  workflowId: "wf_complete",
  observations: [
    {
      toolId: "crm.upsert_contact",
      params: { recordId: "c_ok", fields: { name: "Alice", status: "active" } },
    },
  ],
});
```

### Python / LangGraph / CrewAI (same truth check)

The default verification contract is unchanged: **`agentskeptic check` semantics**, Outcome Certificate on stdout, and **`truth_check_verdict`** on stderr—whether you invoke the published **npm CLI** alongside your stack or use the **Python SDK / extras** documented in **[`docs/integrate.md`](docs/integrate.md)**. Start here: **`pip install`** and framework notes there, plus **[`examples/python-verification/README.md`](examples/python-verification/README.md)**.

See **[`docs/integrate.md`](docs/integrate.md)** (canonical integrator guide — see title in integrate.md) and [`docs/migrate-2.md`](docs/migrate-2.md) for 1.x → 2.0 renames.

### CI (GitHub Actions)

**Default:** copy **[`examples/github-actions/agentskeptic-check.yml`](examples/github-actions/agentskeptic-check.yml)** — first-party **[composite action](https://docs.github.com/en/actions/how-tos/sharing-actions-and-workflows/recording-deployment-history-and-assignments/creating-composite-actions)** at [`.github/actions/agentskeptic-check`](.github/actions/agentskeptic-check) wrapping **`agentskeptic check`** (default **`mode`**). No `AGENTSKEPTIC_API_KEY` on the OSS path. In another repo, pin upstream with `uses: jwekavanagh/agentskeptic/.github/actions/agentskeptic-check@<ref>` (not Marketplace). Advanced CLI flags pass through **`extra-args`**. Transparent manual fallback: invoke `npx agentskeptic check …` inline (same CLI contract). The composite’s default **`agentskeptic@latest`** **`package`** input is **not** a branch-protection posture—pin **`package`** per **[`docs/ambient-ci-distribution.md#composite-package-input-contract-normative`](docs/ambient-ci-distribution.md#composite-package-input-contract-normative)**.

Every composite run produces three CI surfaces: a **certificate-derived job summary** (failure spine + per-step table + witness kinds), a downloadable artifact named **`agentskeptic-outcome-certificate`** (`outcome-certificate.json`), and **structured composite outputs** (`verdict`, `state-relation`, `trust-decision`, `release-critical-verdict`, `failing-tool-ids`, `primary-reason-codes`, `failing-witness-kinds`, `recommended-action`, `automation-safe`, `certificate-path`, plus the existing `stdout-path` / `stderr-path` / `exit-code`). The OSS example needs only **`permissions: contents: read`** — artifact upload uses `ACTIONS_RUNTIME_TOKEN`, not `GITHUB_TOKEN`, so no `actions: write` scope is required. Full contract: **[`docs/ambient-ci-distribution.md`](docs/ambient-ci-distribution.md)**.

**Opt-in commercial / stateful enforcement** (baseline, drift, acceptance): **[`examples/github-actions/agentskeptic-commercial.yml`](examples/github-actions/agentskeptic-commercial.yml)** requires an API key and license server ([`docs/commercial-enforce-gate-normative.md`](docs/commercial-enforce-gate-normative.md)).
<!-- adoption-canonical:end -->

## Buy vs build: why not only SQL checks

**The scar (one pattern, over and over):** the trace says the tool succeeded—here **`crm.upsert_contact`** / **`contacts`**—but the row is missing or wrong. The repo demo names it **`wf_missing`** / **`ROW_ABSENT`**; **the same failure shape** applies whenever your registry maps tool activity to SQL state (ledgers, orders, tickets—not only CRM). That is not a logging problem—it is a **money and risk** problem the moment you ship, bill, close, or treat the run as audit evidence.

**Why “we’ll just write SQL checks” stops working**

- **Drift:** Scripts rot when schemas and workflows change; nobody keeps them current.
- **No ownership:** The author leaves; the checks become folklore.
- **Not an org contract:** Expectations live in heads and one-off files—not in a shared **`tools.json`** + **NDJSON** contract everyone replays.
- **CI and audit:** Ad-hoc checks are skipped locally and rarely ship as **repeatable artifacts**; when the issue is cross-team or compliance, scripts do not hold. Use **CI lock** / enforcement when you need pins ([`docs/ci-enforcement.md`](docs/ci-enforcement.md)).

**What you standardize on instead:** when the row backs revenue or customer promises, **you stop betting the business on whoever wrote the last script.** AgentSkeptic is how the org **owns** the check: one verifier, one replayable contract, **Quick → Contract** when stakes go up—explore with **Quick Verify** ([`docs/quick-verify-normative.md`](docs/quick-verify-normative.md)), lock with **contract** mode and a **`tools.json`** registry when “we ran a query” is not evidence ([`docs/agentskeptic.md`](docs/agentskeptic.md)). **That is the responsible default** once the failure mode hurts.

**Core mechanism:** Read-only SQL checks that your database **at verification time** matches **expectations derived from structured tool activity**—not whether a trace step “succeeded.”

<!-- public-product-anchors:start -->
Read-only checks at verify time—not color.

- **Repository:** https://github.com/jwekavanagh/agentskeptic
- **npm package:** https://www.npmjs.com/package/agentskeptic
- **Canonical site:** https://agentskeptic.com
- **Integrate:** https://agentskeptic.com/integrate
- **Runtime truth-check (CLI / SDK):** https://github.com/jwekavanagh/agentskeptic/blob/main/docs/first-truth-check.md
- **OpenAPI (hosted commercial API):** https://agentskeptic.com/openapi-commercial-v1.yaml
- **Verification Contract Manifest:** https://agentskeptic.com/contract/v1.json
- **llms.txt (agents, site):** https://agentskeptic.com/llms.txt
- **llms.txt (repo, raw):** https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/llms.txt
- **llms.txt (repo, blob):** https://github.com/jwekavanagh/agentskeptic/blob/main/llms.txt

<!-- public-product-anchors:end -->

## Advanced

**Canonical runnable (same API as README `### Code`):** after `npm run build`, run `node examples/decision-gate-canonical.mjs`.

## Try it (about one minute)

This is the fastest way to see **`ROW_ABSENT`** versus **verified** on the same screen—the concrete failure mode the section above is about (bundled CRM-style demo, not your production incident yet).

**Prerequisite:** **Node.js ≥ 22.13** (built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html)), or use [Docker](#docker-quickstart-optional) below.

**Fast first run on your own DB:** run the same `agentskeptic check` from the [Default path](#default-path-one-truth-check) above against your inputs — after `npm install` and `npm run build`:

```bash
agentskeptic check --workflow-id <id> --events <path> --registry <path> --db <sqlitePath>
```

stdout is the Outcome Certificate; stderr begins with `truth_check_verdict: trusted|not_trusted|unknown` plus the human report.

**Local feedback loop with run history (advanced):** `agentskeptic loop` wraps the same `check` contract and adds local run history, prior-run comparison, and a single TRUSTED / NOT TRUSTED / UNKNOWN line for tight inner-loop iteration — normative contract: [`docs/local-feedback-loop.md`](docs/local-feedback-loop.md).

**Advanced compatibility paths:** `agentskeptic quick`, `agentskeptic crossing`, and `agentskeptic verify-integrator-owned` remain supported for specialized workflows and CI parity; they are not the first-run path.

```bash
npm install
npm start
```

**What you should see:** `npm start` builds, seeds **`examples/demo.db`**, and runs two workflows from **`examples/events.ndjson`** with **`examples/tools.json`**. The first case ends **`complete` / `verified`**; the second **`inconsistent` / `missing`** with reason **`ROW_ABSENT`**. That contrast is the product on one screen.

`npm install` does not compile TypeScript. To run the CLI without `npm start`, run **`npm run build`** first so **`dist/`** exists.

### Docker quickstart (optional)

Use this when you want the bundled demo without Node **22.13+** on the host. The repo is bind-mounted so **`examples/demo.db`** stays on your machine.

**Bash / macOS / Linux** (repo root):

```bash
docker run --rm -it -v "$PWD:/work" -w /work node:22-bookworm bash -lc "npm install && npm start"
```

**PowerShell** (repo root):

```powershell
docker run --rm -it -v "${PWD}:/work" -w /work node:22-bookworm bash -lc "npm install && npm start"
```

## Minimal model (event → registry → result)

**One structured observation** (NDJSON line; full schema in [Event line schema](docs/agentskeptic.md#event-line-schema)):

```json
{"schemaVersion":1,"workflowId":"wf_complete","seq":0,"type":"tool_observed","toolId":"crm.upsert_contact","params":{"recordId":"c_ok","fields":{"name":"Alice","status":"active"}}}
```

**Registry entry** (excerpt; full file is **`examples/tools.json`**) telling the engine how that `toolId` maps to a row check:

```json
{
  "toolId": "crm.upsert_contact",
  "verification": {
    "kind": "sql_row",
    "table": { "const": "contacts" },
    "identityEq": [{ "column": { "const": "id" }, "value": { "pointer": "/recordId" } }],
    "requiredFields": { "pointer": "/fields" }
  }
}
```

**When the row matches:** workflow result (excerpt; demo prints full JSON to stdout):

```json
{
  "workflowId": "wf_complete",
  "status": "complete",
  "steps": [{ "seq": 0, "toolId": "crm.upsert_contact", "status": "verified" }]
}
```

When the row is missing or fields disagree, you get **`inconsistent`** / **`missing`** and reason codes such as **`ROW_ABSENT`**.

## What this is (and is not)

Retries, partial failures, and race conditions mean a success flag in a trace is not proof the intended row exists with the right values. The engine derives **expected** state from your registry and events and compares it to **observed** state with read-only `SELECT`s.

| This **is** | This is **not** |
|-------------|-----------------|
| A **SQL ground-truth state check** against expectations from structured tool activity | Generic observability, log search, or arbitrary unstructured logs |
| A verifier for **persisted state** after agent or automation workflows | A test runner for application code |
| Proof that **observed DB state matched expectations** at verification time | Proof that a tool **executed**, **wrote**, or **caused** that state |

**This is for you if** you need persisted-row SQL truth after agent or automation runs when the trace looks fine but the DB might not.

**This is not for you if** you need proof a tool executed, log search as verification, or a model where read-only SQL against your app DB is not the right check. Homepage “for you / not for you” copy lives in **`website/src/content/productCopy.ts`** (single source with the site).

**Trust boundary (once):** a green trace does **not** prove the row exists with the right values—only whether **read-only `SELECT`s** matched **expected** rows under your rules, not deep causality.

**Declared → expected → observed** (how reports reason about runs):

1. **Declared** — what the captured tool activity encodes (`toolId`, parameters).
2. **Expected** — what should hold in SQL under the rules (in **Quick Verify**, inferred; in **contract mode**, registry-driven from events).
3. **Observed** — what read-only SQL returned at verification time.

## Contract path (registry + events)

**CLI:** the canonical local replay command is **`agentskeptic check`** (see [Default path](#default-path-one-truth-check) above) — the same command CI and the Cursor rule wrap. After **`npm install`** and **`npm run build`**, run it via `agentskeptic check` (or `node dist/cli.js check`). Postgres: **`--postgres-url`** instead of **`--db`** (exactly one).

Typical integration:

1. Emit **one NDJSON line per tool observation** (see [Event line schema](docs/agentskeptic.md#event-line-schema)).
2. Add a **registry** entry per `toolId` (start from **`examples/templates/`**).
3. Run the truth check:

```bash
npm run build
agentskeptic check --workflow-id <id> --events <path> --registry <path> --db <sqlitePath>
```

Replay the bundled files: **`wf_complete`** / **`examples/events.ndjson`** / **`examples/tools.json`** / **`examples/demo.db`** (same flags as above).

**From source without `agentskeptic` on PATH:** `node dist/cli.js` with the same flags.

**Why SQLite in the demo:** file-backed ground truth with no extra services. The demo (re)creates **`examples/demo.db`**; verification still uses read-only SQL.

## Quick Verify and assurance (optional)

**Quick Verify** (`agentskeptic quick`): inferred checks, **no registry file**; **provisional**, not audit-final—graduate to **contract mode** for explicit per-tool expectations. Full contract: **[`docs/quick-verify-normative.md`](docs/quick-verify-normative.md)**.

**Input contract:** We only accept **structured tool activity**—JSON or NDJSON that describes tool calls and parameters our ingest model can extract—not arbitrary logs, traces, or unstructured observability text.
**Quick** uses read-only SQL against the database you pass in. **Contract** verification adds registry-backed checks for HTTP witnesses, object storage, vector indexes, and Mongo where configured—see [`docs/verification-state-stores.md`](docs/verification-state-stores.md).

```bash
npm run build
agentskeptic quick --input test/fixtures/quick-verify/pass-line.ndjson --db examples/demo.db --export-registry ./quick-export.json
```

Use **`--postgres-url`** instead of **`--db`**; **`-`** as **`--input`** reads stdin.

**Assurance** (`assurance run` / `assurance stale`): multi-scenario sweeps and staleness over saved reports; success paths emit one **`AssuranceOutputV1`** JSON line on stdout (embedded **`runReport`**)—**[Assurance subsystem](docs/agentskeptic.md#assurance-subsystem-normative)**, **[`examples/assurance/manifest.json`](examples/assurance/manifest.json)**.

## Sample output (contract demo)

The **`npm start`** driver prints human report + workflow JSON to **stdout** (one stream for the demo). Normal CLI: machine JSON on **stdout**, human report on **stderr**—[Human truth report](docs/agentskeptic.md#human-truth-report). **Full success/failure transcripts** (same strings as below) are in the [acquisition fold](#your-traces-say-success-your-database-disagrees) at the top of this README.

Operational note: `agentskeptic check` / `agentskeptic quick` persist one verification receipt JSON per run under `artifacts/agentskeptic-receipts/` (write/schema failures are fail-closed with exit 3).

### Success (`wf_complete`)

*Interpretation:* Under the configured rules, **expected** state matched **observed SQL** for this step—**state alignment**, not proof of execution.

### Failure (`wf_missing`)

*Interpretation:* **Expected** state from the tool activity implied a row **observed SQL** did not find—**inconsistent**—a gap traces alone often miss. Still not proof a write was attempted or rolled back.

## How this differs from logs, tests, and observability

| Approach | What it tells you |
|----------|-------------------|
| **Logs / traces** | A step ran, duration, errors—not “row X has columns Y.” |
| **Unit / integration tests** | Code paths in your repo—not production agent runs against live DB state. |
| **Metrics / APM** | Health and latency—not semantic equality of persisted records. |
| **Ad-hoc SQL checks / one-off scripts** | Same failure mode as [**Buy vs build**](#buy-vs-build-why-not-only-sql-checks)—drift, weak ownership, not a durable contract. |
| **agentskeptic** | Whether **observed SQL** matches **expectations from declared tool parameters** (contract mode), via read-only SQL—not proof the tool executed. |

## When to run it

Run **after** a workflow (or CI replay of its log), **before** you treat the outcome as safe for customer-facing or regulated actions.

**Inputs:** NDJSON observations, registry JSON, read-only **SQLite** or **Postgres**. Semantics: [`docs/relational-verification.md`](docs/relational-verification.md).

**Typical uses:** block a release, trigger human review, open an incident, or attach a verification artifact to an audit trail.

**CI with over-time guarantees:** use stateful **`agentskeptic enforce`** baseline/check/accept lifecycle—[`docs/ci-enforcement.md`](docs/ci-enforcement.md).

## Further capabilities (reference)

Everything beyond core contract verification lives in **[`docs/agentskeptic.md`](docs/agentskeptic.md)**—subcommands, hooks, bundles, debug, plan transition, human report layout, exit codes.

## Documentation map

| Doc | Purpose |
|-----|---------|
| [`docs/contract.md`](docs/contract.md) | **Verification Contract Manifest** SSOT — names, hashes, and versions the event/registry/registry-export schemas; one URL, one CI gate |
| [`docs/epistemic-contract.md`](docs/epistemic-contract.md) | **Normative epistemic contract** (grounded output vs funnel; ranking limits; telemetry proxies)—single authored source; other docs link or generate from here |
| [README — Buy vs build](#buy-vs-build-why-not-only-sql-checks) | Canonical **buy vs build** narrative (failure mode, scripts limits, Quick → Contract) |
| [`docs/agentskeptic.md`](docs/agentskeptic.md) | Authoritative CLI and behavior reference (SSOT) |
| [`docs/cursor-integration.md`](docs/cursor-integration.md) | Consumer Cursor rule template for running local `agentskeptic check` truth checks |
| [`docs/quick-verify-normative.md`](docs/quick-verify-normative.md) | Quick Verify normative contract |
| [`docs/verification-product.md`](docs/verification-product.md) | Product intent, trust boundary, authority matrix |
| [`docs/reconciliation-vocabulary.md`](docs/reconciliation-vocabulary.md) | Reconciliation dimension IDs and UI mapping |
| [`docs/verification-operational-notes.md`](docs/verification-operational-notes.md) | First-run runbooks, TTFV, export vs replay coverage |
| [`docs/langgraph-reference-boundaries.md`](docs/langgraph-reference-boundaries.md) | LangGraph reference path: emitter/CLI boundaries and test chain |
| [`docs/langgraph-checkpoint-trust.md`](docs/langgraph-checkpoint-trust.md) | LangGraph checkpoint trust: v3 wire, terminal contract, shared kernel, production gate |
| [`docs/relational-verification.md`](docs/relational-verification.md) | Relational verification semantics |
| [`docs/ci-enforcement.md`](docs/ci-enforcement.md) | CI enforcement and lock fixtures |
| [`docs/correctness-definition-normative.md`](docs/correctness-definition-normative.md) | Correctness and limits (normative) |

## Development and testing

**Why SQLite:** same note as under [Contract path](#contract-path-registry--events) (file-backed demo DB; read-only verification SQL).

**`npm test`** runs **`npm run verification:truth`** (regeneration + contract gate, Postgres distribution, then full journey suite). Requires **`DATABASE_URL`** and **`TELEMETRY_DATABASE_URL`** (see [`website/.env.example`](website/.env.example)). Ordering: **[`docs/testing.md`](docs/testing.md)**.

**Full CI parity** (Postgres + Playwright for Debug Console): set **`POSTGRES_ADMIN_URL`** and **`POSTGRES_VERIFICATION_URL`**, then **`npm run test:ci`**. See **[`docs/testing.md`](docs/testing.md)**, [`.github/workflows/ci.yml`](.github/workflows/ci.yml), and: `docker run -d --name etl-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`.

## Commercial CLI (npm) vs OSS (this repo)

<!-- codegen:buyer-truth:start:COMMERCIAL_ENTRY -->
**Commercial metering (published npm)** uses `AGENTSKEPTIC_API_KEY` + `POST /api/v1/usage/reserve` as documented in docs/commercial.md — account-pooled quota per billing month.

**OSS/unmetered CLI** for single-run verification: clone this repo and use the OSS build (`WF_BUILD_PROFILE=oss` / default `npm run build` artifact). State over-time `enforce` needs the commercial CLI and a paid entitlement.
<!-- codegen:buyer-truth:end:COMMERCIAL_ENTRY -->

Canonical write-up: **[`docs/commercial.md`](docs/commercial.md)** (npm package, Stripe, keys, telemetry, validation, entitlements; operator metrics in **[`docs/funnel-observability.md`](docs/funnel-observability.md)**—OSS CLI product-activation posts are **opt-in** via **`AGENTSKEPTIC_TELEMETRY=1`** or persisted config; **`AGENTSKEPTIC_TELEMETRY=0`** forces them off). OSS builds in this repo run stateless contract checks via **`agentskeptic check`** (and positional compatibility invocation) / **`quick`** without a license server. Stateful **`agentskeptic enforce`** (commercial / stateful / opt-in) and over-time guarantees require a commercial build per **[`docs/commercial-enforce-gate-normative.md`](docs/commercial-enforce-gate-normative.md)**.

**GitHub Actions:** default OSS **truth check** (composite **`agentskeptic check`**) — **[`examples/github-actions/agentskeptic-check.yml`](examples/github-actions/agentskeptic-check.yml)** + [`.github/actions/agentskeptic-check`](.github/actions/agentskeptic-check). Opt-in **enforcement** — **[`examples/github-actions/agentskeptic-commercial.yml`](examples/github-actions/agentskeptic-commercial.yml)**. See **[`docs/ambient-ci-distribution.md`](docs/ambient-ci-distribution.md)**.

## Status, contributing, security

**Maturity:** **0.x** (`package.json`). APIs, CLI flags, and JSON schemas may evolve; rely on tests and docs for current contracts.

**Contributing:** see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

**Security:** see **[SECURITY.md](SECURITY.md)**.

## License

Released under the **MIT License** — **[LICENSE](LICENSE)**.
