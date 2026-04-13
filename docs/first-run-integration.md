# First-run integration (SSOT)

This is the **single integrator path** for running AgentSkeptic against **your own** database and workflow shape. It replaces scattered copies of the same steps elsewhere in the repo.

**Why one path:** One document reduces drift between the website, README, and ad-hoc integrator notes. **Production and CI** with the **published npm** `agentskeptic`: complete **Stripe checkout** for a self-serve paid plan (**Individual**, **Team**, or **Business**; trial is fine) or an **Enterprise** arrangement so your account has an **active subscription**, then create an **`AGENTSKEPTIC_API_KEY`** (legacy **`WORKFLOW_VERIFIER_API_KEY`** is still accepted by the CLI) and use your deployed license server—**licensed `verify` / `quick` require that subscription** before each run (see [`commercial-entitlement-policy.md`](commercial-entitlement-policy.md)). **Building from this repository** with the default **`WF_BUILD_PROFILE=oss`** is for **local development, forks, and air-gapped** **`verify`** without a key; **CI locks** (`--output-lock` / `--expect-lock`) and **`enforce`** require a **commercial** build — [README.md](../README.md), **[`docs/commercial-enforce-gate-normative.md`](commercial-enforce-gate-normative.md)**.

When the license server denies a run because the subscription is inactive (`SUBSCRIPTION_INACTIVE`), the commercial CLI appends the **`upgrade_url`** returned by **`POST /api/v1/usage/reserve`** (typically your site’s **Pricing** URL) to the error message so operators can fix billing without hunting logs.

**Machine-readable contracts** (plans + reserve API): see [`commercial-ssot.md`](commercial-ssot.md) — **`GET /api/v1/commercial/plans`** and **`/openapi-commercial-v1.yaml`** on your deployed site origin.

**Operator metrics:** funnel event names, HTTP contracts, SQL examples, and CLI beacon semantics are in [`funnel-observability-ssot.md`](funnel-observability-ssot.md).

Send this to someone who should **try it in one sitting**. **All shell commands** for the bundled integration quickstart live in **[partner-quickstart-commands.md](partner-quickstart-commands.md)** (generated; do not duplicate here). This file is **prose, semantics, and guarantees** only.

## 0. Bootstrap pack (optional shortcut)

If you already have **OpenAI-style `tool_calls`** JSON (see **`BootstrapPackInput` v1** in [`bootstrap-pack-normative.md`](bootstrap-pack-normative.md)) and a read-only **SQLite** or **Postgres** URL, you can generate **`events.ndjson`**, **`tools.json`**, **`quick-report.json`**, and a short **`README.bootstrap.md`** in one step:

```bash
agentskeptic bootstrap --input path/to/bootstrap-input.json --db path/to/your.db --out path/to/new-pack-dir
```

Normative flags, stdout/stderr, exit codes, and trust inheritance are **only** in [`bootstrap-pack-normative.md`](bootstrap-pack-normative.md). After a successful run (exit `0`), use the generated files as the starting contract for production NDJSON emission, or continue with the demo and integration steps below.

## 1. What this does

- Takes an **append-only NDJSON log** of tool observations (what the agent claims it did).
- Uses a small **`tools.json` registry** to turn each call into **expected SQL row/field checks**.
- Runs **read-only `SELECT`s** against **SQLite or Postgres** and emits a **human report + machine JSON** (`complete` / `inconsistent` / `incomplete`).

## 2. What you need

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **≥ 22.13** (demo uses built-in `node:sqlite`). |
| **SQLite** *or* **Postgres** | One database the verifier can reach **read-only** for checks. |
| **Docker** | Optional—handy to spin up **Postgres** locally (`postgres:16` is enough). |

From the repo root: **`npm install`** once.

## 3. Step 1: Run the demo

```bash
npm start
```

This builds, seeds **`examples/demo.db`**, runs two workflows from the bundled files, and prints reports plus JSON. You should see **`wf_complete`** end **`complete` / `verified`** and **`wf_missing`** end **`inconsistent` / `missing`** with **`ROW_ABSENT`**.

## 4. Step 2: Try on your system (minimal)

Canonical example files (do not duplicate their contents in this doc):

| File | Role |
|------|------|
| **`examples/partner-quickstart/partner.events.ndjson`** | One NDJSON line per observed tool call; **`workflowId`** is **`wf_partner`**. |
| **`examples/partner-quickstart/partner.tools.json`** | Registry for **`crm.upsert_contact`**. |
| **`examples/partner-quickstart/partner.seed.sql`** | `CREATE TABLE contacts` + row for **`partner_1`**. |

**Fast path:** from the repository root, use the linked commands document above — start with **`npm run partner-quickstart`** (SQLite) or set **`PARTNER_POSTGRES_URL`** for Postgres.

To force a mismatch after a successful run, delete that row or change `name`/`status` in the DB and run verification again—you should get **`inconsistent`** with **`ROW_ABSENT`** or a field mismatch in the report.

## 5. What success looks like

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

## 6. Common mistakes

- **Node too old** — need **22.13+**; upgrade before `npm start`.
- **No build** — run **`npm run build`** (or **`npm start`** once) so **`dist/`** exists before calling **`node dist/cli.js`**.
- **Both or neither DB flags** — pass **exactly one** of **`--db`** or **`--postgres-url`**.
- **`--workflow-id` mismatch** — must match `workflowId` in the NDJSON lines you want verified.
- **Missing registry entry** — every `toolId` in the log needs a matching object in **`tools.json`**.
- **Params vs registry** — JSON pointers like **`/recordId`** and **`/fields`** must exist on `params` for that tool line.
- **Commands out of date** — regenerate `docs/partner-quickstart-commands.md` with **`node scripts/generate-partner-quickstart-commands.mjs`** after changing quickstart wiring (CI checks this).
- **Node SQLite warning** — `ExperimentalWarning: SQLite is...` on stderr is from Node; it does not mean verification failed.

## LangGraph reference path

For LangGraph-style orchestration, start from [`examples/langgraph-reference/README.md`](../examples/langgraph-reference/README.md) and treat documentation boundaries as frozen in [`verification-product-ssot.md`](verification-product-ssot.md#langgraph-reference-documentation-boundaries) (do not restate the authority matrix in this prose file).

---

NPM package: **agentskeptic**. Installed CLI name: **agentskeptic** (same flags as `node dist/cli.js`).
