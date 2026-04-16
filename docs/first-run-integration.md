# First-run integration (SSOT)

**Prerequisite:** Read [**Buy vs build: why not only SQL checks**](../README.md#buy-vs-build-why-not-only-sql-checks) in the root [**README.md**](../README.md) so the recurring failure mode, why ad-hoc SQL checks fail as a long-term substitute, and the **Quick → Contract** path are clear before you integrate.

This is the **authoritative first-run path** for running AgentSkeptic against **your own** database and workflow shape: demo → partner quickstart → success criteria → pitfalls. Anything outside that sequence (bootstrap, LangGraph sample, production billing) is grouped **after** the spine—this file stays integrator prose, not an index of every entrypoint.

**Why one doc:** One narrative reduces drift between the website, README, and ad-hoc integrator notes.

Send this to someone who should **try it in one sitting**. **All shell commands** for the bundled integration quickstart live in **[partner-quickstart-commands.md](partner-quickstart-commands.md)** (generated; do not duplicate here). This file is **prose, semantics, and guarantees** only.

## What this does

- Takes an **append-only NDJSON log** of tool observations (what the agent claims it did).
- Uses a small **`tools.json` registry** to turn each call into **expected SQL row/field checks**.
- Runs **read-only `SELECT`s** against **SQLite or Postgres** and emits a **human report + machine JSON** (`complete` / `inconsistent` / `incomplete`).

## What you need

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **≥ 22.13** (demo uses built-in `node:sqlite`). |
| **SQLite** *or* **Postgres** | One database the verifier can reach **read-only** for checks. |
| **Docker** | Optional—handy to spin up **Postgres** locally (`postgres:16` is enough). |
| **npm / CLI** | From this repo: **`npm install`** once, then **`npm run build`** so **`dist/`** exists. Published **npm** installs the **`agentskeptic`** binary—same CLI as **`node dist/cli.js`**. |

## Step 1: Run the demo

```bash
npm start
```

This builds, seeds **`examples/demo.db`**, runs two workflows from the bundled files, and prints reports plus JSON. You should see **`wf_complete`** end **`complete` / `verified`** and **`wf_missing`** end **`inconsistent` / `missing`** with **`ROW_ABSENT`**.

## Step 2: Try on your system (minimal)

Canonical example files (do not duplicate their contents in this doc):

| File | Role |
|------|------|
| **`examples/partner-quickstart/partner.events.ndjson`** | One NDJSON line per observed tool call; **`workflowId`** is **`wf_partner`**. |
| **`examples/partner-quickstart/partner.tools.json`** | Registry for **`crm.upsert_contact`**. |
| **`examples/partner-quickstart/partner.seed.sql`** | `CREATE TABLE contacts` + row for **`partner_1`**. |

**Fast path:** from the repository root, use the linked commands document above — start with **`npm run partner-quickstart`** (SQLite) or set **`PARTNER_POSTGRES_URL`** for Postgres.

To force a mismatch after a successful run, delete that row or change `name`/`status` in the DB and run verification again—you should get **`inconsistent`** with **`ROW_ABSENT`** or a field mismatch in the report.

## What success looks like

- **Exit code `0`**: stdout is one **WorkflowResult** JSON object with `"status":"complete"` and the step `"verified"`.
- **Stderr** (default) is the **human verification report** (trust line + per-step wording). Use **`--no-truth-report`** if you want stderr empty and JSON-only on stdout.

Example stdout (one JSON object; `schemaVersion` and nested fields evolve over releases):

```json
{
  "schemaVersion": 15,
  "workflowId": "wf_partner",
  "status": "complete",
  "steps": [
    {
      "seq": 0,
      "toolId": "crm.upsert_contact",
      "status": "verified"
    }
  ]
}
```

The human report on stderr will state that the workflow **matched the database** for that step.

## Common mistakes

- **Node too old** — need **22.13+**; upgrade before `npm start`.
- **No build** — run **`npm run build`** (or **`npm start`** once) so **`dist/`** exists before calling **`node dist/cli.js`**.
- **Both or neither DB flags** — pass **exactly one** of **`--db`** or **`--postgres-url`**.
- **`--workflow-id` mismatch** — must match `workflowId` in the NDJSON lines you want verified.
- **Missing registry entry** — every `toolId` in the log needs a matching object in **`tools.json`**.
- **Params vs registry** — JSON pointers like **`/recordId`** and **`/fields`** must exist on `params` for that tool line.
- **Commands out of date** — regenerate `docs/partner-quickstart-commands.md` with **`node scripts/generate-partner-quickstart-commands.mjs`** after changing quickstart wiring (CI checks this).
- **Node SQLite warning** — `ExperimentalWarning: SQLite is...` on stderr is from Node; it does not mean verification failed.

## Optional (after the main path)

These are **not** steps 3–4 of the integrator walkthrough—only reach for them after the demo and partner flow above.

**Bootstrap pack** — If you already have **OpenAI-style `tool_calls`** JSON and a read-only **SQLite** or **Postgres** URL, you can generate **`events.ndjson`**, **`tools.json`**, **`quick-report.json`**, and **`README.bootstrap.md`** in one step—normative contract, flags, and trust rules are only in [`bootstrap-pack-normative.md`](bootstrap-pack-normative.md). Example:

```bash
agentskeptic bootstrap --input path/to/bootstrap-input.json --db path/to/your.db --out path/to/new-pack-dir
```

Use the generated artifacts as your starting contract for production NDJSON emission, or skip this entirely.

**LangGraph-shaped sample** — Minimal graph run + verify: [`examples/langgraph-reference/README.md`](../examples/langgraph-reference/README.md). What that README may claim vs SSOT is fixed in [`langgraph-reference-boundaries-ssot.md`](langgraph-reference-boundaries-ssot.md#langgraph-reference-documentation-boundaries).

---

## Production npm, billing, telemetry, and operator metrics

Shipping the **published npm** package, **Stripe** checkout, **`AGENTSKEPTIC_API_KEY`** (or legacy **`WORKFLOW_VERIFIER_API_KEY`**), **`POST /api/v1/usage/reserve`**, CI **`enforce`**, split deployments, **`AGENTSKEPTIC_TELEMETRY=0`**, **`install_id`**, and operator funnel metrics are **not** first-run steps—read **[`commercial-ssot.md`](commercial-ssot.md)** end-to-end, then **[`commercial-entitlement-policy.md`](commercial-entitlement-policy.md)** and **[`commercial-enforce-gate-normative.md`](commercial-enforce-gate-normative.md)** for build gates. Beacon semantics, HTTP contracts, and growth SQL live in **[`funnel-observability-ssot.md`](funnel-observability-ssot.md)** and **[`growth-metrics-ssot.md`](growth-metrics-ssot.md)**. The root **[README.md](../README.md)** summarizes OSS vs commercial builds.
