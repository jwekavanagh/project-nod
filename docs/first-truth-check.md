# First truth check

The trace can be green and the tool wrapper can say **success** while the downstream store is still **wrong or missing the row** you care about—the same failure shape as the bundled **`wf_missing`** demo (`ROW_ABSENT`). To see **`truth_check_verdict: not_trusted`** quickly: from the repo root run **`npm install`**, **`npm run build`**, then **`npm start`** (runs **`wf_complete`** and **`wf_missing`** against `examples/demo.db`), or open the missing-write demo at **`https://agentskeptic.com/verify`**.

Run one stateless AgentSkeptic truth check and understand the result.

**Default first run:** `agentskeptic check`.

Use **`check`** for the first stateless truth check. It does **not** require an **`AGENTSKEPTIC_API_KEY`** or a license server.

Optional preview: **`agentskeptic quick`** can give a cheap SQL-oriented preview on captured activity; graduate to **`check`** when you need contract-grade verification (see [`integrate.md`](integrate.md)).

For TypeScript, the same contract is **`await skeptic.check({ … })`** / **`AgentSkeptic.check`** — stdout is still the Outcome Certificate-shaped result from the engine (see [`integrate.md`](integrate.md) for SDK wiring).

## What you get

- **stdout:** one **Outcome Certificate v3** (machine JSON, top-level **`schemaVersion: 3`**, required **`failureSpine`** + **`evidenceCompleteness`**). Artifact naming vs receipts and decision-bundle exits: **[Trust artifact naming glossary](outcome-certificate-normative.md#trust-artifact-naming-glossary)**.
- **stderr:** **`truth_check_verdict:`** then **`release_critical_truth_check_verdict:`** (each **`trusted`**, **`not_trusted`**, or **`unknown`**) on their **own lines** before the human certificate report (anonymous activation telemetry may print unrelated status lines earlier — CI often sets **`AGENTSKEPTIC_TELEMETRY=0`** to keep stderr minimal).

**Optional coverage budgets:** when **`budgetActive`** (see **[`integrate.md` § Optional coverage budgets](integrate.md#optional-coverage-budgets)**), two additional machine lines **`coverage_budget_verdict:`** and **`coverage_budget_detail:`** follow the truth lines, plus a **`=== coverage_budget ===`** human block. Default runs without a policy file or **`--coverage-budget`** stay at the two-line truth prefix only.

Logs, traces, CI green, wrapper summaries, or agent claims are **not** the source of truth when they disagree with the Outcome Certificate or the verdict line.

When you need **retained files** for CI artifacts, customer review, or audit handoff (beyond stdout/stderr), follow the **three-step evidence ladder** in **[`decision-evidence-bundle.md`](decision-evidence-bundle.md)** (default check → optional `--proof` / `--write-decision-bundle` → optional `--write-run-bundle` for full local proof). The default first run stays exactly as above; bundle flags are opt-in.

## Before you start

You supply:

| Input | Role |
|--------|------|
| **Workflow id** | `--workflow-id` — identifies the workflow under verification (never inferred). |
| **Events / observations** | NDJSON file: **`--events`** — structured tool activity to replay (e.g. `examples/events.ndjson`). |
| **Tools registry** | JSON registry: **`--registry`** — maps tools and verification targets (e.g. `examples/tools.json`). |
| **State store / witnesses** | At least one readable verification target — commonly **`--db`** for SQLite; Postgres URLs and registry-defined HTTP/object/vector/Mongo witnesses per your setup (see [`integrate.md`](integrate.md)). |

AgentSkeptic does **not** auto-discover these paths unless you use documented defaults (for example **`--project`** with the conventional layout). Pass paths explicitly when yours differ.

## One workflow on your own data

Stay with **one** workflow until you have a trusted pass or a clear `not_trusted` you can act on—skip baselines, **`enforce`**, dashboards, and multi-store expansion until later.

1. **Workflow id** — `--workflow-id` naming the run you verify (never inferred).
2. **Observed tool activity** — NDJSON replay file (`--events`), or the conventional **`agentskeptic/events.ndjson`** when using **`--project`**.
3. **Registry** — **`agentskeptic/tools.json`** mapping each **`toolId`** you care about to expected store checks (`--registry`, or default under **`--project`**).
4. **Readable store** — **`--db`** SQLite path or Postgres URL (read-only principal at verify time).
5. **Run** — `agentskeptic check --workflow-id YOUR_WORKFLOW_ID ...` (same flags as [Run the default check](#run-the-default-check)).

If you get **`unknown`**, add observations, fix registry mapping, or narrow scope before relying on the outcome.

## Validate your registry (before the first meaningful check)

Catch schema and mapping mistakes **before** you interpret a **`unknown`** exit as “the verifier disagrees with reality.” Prefer **`agentskeptic validate-registry`** when you are authoring or updating **`examples/tools.json`** (or your own registry path):

```bash
agentskeptic validate-registry --registry examples/tools.json
```

Optional tightening (replay-shaped validation when you already have NDJSON):

```bash
agentskeptic validate-registry \
  --registry examples/tools.json \
  --events examples/events.ndjson \
  --workflow-id wf_complete
```

Stdout is **`RegistryValidationResult` JSON**. Exit **`0`** = valid registry; **`3`** = operational failure (stderr JSON envelope only).

## Preview versus contract verification (`agentskeptic quick`)

| Surface | **`agentskeptic quick`** | **`agentskeptic check`** (default first truth path) |
|---------|---------------------------|------------------------------------------------------|
| Role | Cheap **SQL inference preview** on captured activity — stdout carries **`runKind: quick_preview`**. | **Decision-grade** contract replay: registry, events, readable stores — stdout **`runKind: contract_sql`** (or registry-defined witnesses). |
| Human copy | **`Rollup (inferred, provisional): pass`**, **`fail`**, or **`uncertain`** anchors ( **`docs/quick-verify-normative.md`** ). | **`truth_check_verdict: trusted`**, **`not_trusted`**, or **`unknown`** on its own line before certificate human report (optional telemetry banners may precede it). |
| **`truth_check_verdict`** | **Not emitted on stderr.** Read stdout Outcome Certificate fields (**`runKind`**, **`stateRelation`**, **`highStakesReliance`**). A rollup **`pass`** is **not** decision-grade **`trusted`**. | Emitted first on verdict exits (**`--no-human-report`** keeps this line only; it does not suppress the verdict). |

**Stdout / stderr ordering differs by design:**

- **`quick`:** Writes **one Outcome Certificate line to stdout first**, **then** stderr human report/footer ( **`src/cli.ts` `runQuickSubcommand`** , **`docs/quick-verify-normative.md`** ).
- **`check`:** Writes **stderr** (verdict prefix + human report) **before** the **stdout** certificate line finishes the bundled verify CLI path.

Use **`check`** wherever automation or docs require the **`truth_check_verdict`** line on stderr; **`quick`** stays a preview aid.

## Run the default check

**Concrete example (repo demo assets):**

```bash
npx agentskeptic check \
  --workflow-id wf_complete \
  --events examples/events.ndjson \
  --registry examples/tools.json \
  --db examples/demo.db
```

**Generic placeholders:**

```bash
npx agentskeptic check \
  --workflow-id YOUR_WORKFLOW_ID \
  --events path/to/events.ndjson \
  --registry path/to/tools.json \
  --db path/to/readable.sqlite
```

Full flag reference: [`agentskeptic.md`](agentskeptic.md). Deeper integration SSOT: [`integrate.md`](integrate.md).

## Read the result

**stdout:** **Outcome Certificate** (machine JSON).

**stderr:** human report preceded by **`truth_check_verdict:`** then **`release_critical_truth_check_verdict:`** on **separate lines** (ignore leading telemetry banners if present). Typical prefixes:

```text
truth_check_verdict: trusted
release_critical_truth_check_verdict: trusted
truth_check_verdict: not_trusted
release_critical_truth_check_verdict: trusted
truth_check_verdict: unknown
release_critical_truth_check_verdict: unknown
```

| Verdict | Meaning |
|---------|---------|
| **`trusted`** | The checked outcome matched expected downstream state — only this verdict means you can rely on the verified workflow for this run. |
| **`not_trusted`** | Determinate mismatch or missing required state — do **not** claim verified; fix the mismatch. |
| **`unknown`** | Evidence incomplete or not established — do **not** claim verified; collect evidence or narrow scope. |

### Verdict → next action

- **`trusted`** — Proceed with ship, bill, handoff, or automation **only** when your policy allows and nothing else contradicts the Outcome Certificate and verdict line.
- **`not_trusted`** — **Block** reliance; fix the workflow, data, or registry expectation, then re-run **`check`**.
- **`unknown`** — **Do not** treat the run as verified; add evidence (observations, witnesses) or narrow scope until the verdict is determinate.

If anything else says “verified” but the Outcome Certificate or **`truth_check_verdict`** disagrees, trust the certificate and verdict. For **release-critical-only** CI gating, use composite **`fail-on: critical_not_trusted_or_unknown`** (see **`ambient-ci-distribution.md`**).

## Add it to GitHub Actions

<!-- agentskeptic-ci-summary-legend:v1 -->
The composite action’s GitHub **job summary** is derived from the **Outcome Certificate v3** parsed off CLI stdout: a `failureSpine` block (trust decision + recommended action), a per-step / per-effect failures table, witness kinds, and a pointer to the run’s **`agentskeptic-outcome-certificate`** artifact (`outcome-certificate.json`). Structured composite outputs (`state-relation`, `trust-decision`, `release-critical-verdict`, `failing-tool-ids`, `primary-reason-codes`, `failing-witness-kinds`, `recommended-action`, `automation-safe`, `certificate-path`) let downstream jobs branch without `grep` / `jq`. Full surface and OSS-friendly permissions story (`contents: read` only — no `actions: write`): **[`ambient-ci-distribution.md`](ambient-ci-distribution.md)**.

After the local command works, wire the same CLI contract in CI.

Copy **[`examples/github-actions/agentskeptic-check.yml`](../examples/github-actions/agentskeptic-check.yml)** verbatim as the default posture: **Node 22 before `node:sqlite`**, **`agentskeptic/`** layout for **`project: .`**, **`AGENTSKEPTIC_TELEMETRY=0`**, **one** **`npm install --no-save`** keyed by **`AGENTSKEPTIC_CI_PACKAGE`**, and composite **`package:`** **`${{ env.AGENTSKEPTIC_CI_PACKAGE }}`** (floating **`agentskeptic@latest`** is for quick demos only — see **[Composite package input contract (normative)](ambient-ci-distribution.md#composite-package-input-contract-normative)**).

- Default OSS path: composite action **[`../.github/actions/agentskeptic-check/action.yml`](../.github/actions/agentskeptic-check/action.yml)** — default **`mode`** is **`check`**; **no** **`AGENTSKEPTIC_API_KEY`** on that path.
- In **this** repository you can use a relative path (same inputs as the example; pin bumps **`AGENTSKEPTIC_CI_PACKAGE`** with releases):

```yaml
- uses: actions/checkout@v5
- uses: actions/setup-node@v5
  with:
    node-version: "22"
# … prepare agentskeptic/ + demo DB + npm install --no-save (see full example file)
- uses: ./.github/actions/agentskeptic-check
  with:
    workflow-id: wf_complete
    project: .
    package: ${{ env.AGENTSKEPTIC_CI_PACKAGE }}
    db: examples/demo.db
```

In another repository, pin the upstream action (not Marketplace):  
`uses: OWNER/agentskeptic/.github/actions/agentskeptic-check@<ref>`  
and align **`project`** / **`events`+`registry`**, **`package`**, and **`extra-args`** with your layout (XOR rules in **[`ambient-ci-distribution.md`](ambient-ci-distribution.md)**).

The Action is a **thin CI wrapper** around **`agentskeptic check`** — same stdout/stderr contract as local CLI.

**Later / opt-in commercial path:** baseline enforcement and drift workflows use **`agentskeptic enforce`**, **`AGENTSKEPTIC_API_KEY`**, and **[`examples/github-actions/agentskeptic-commercial.yml`](../examples/github-actions/agentskeptic-commercial.yml)** — see [`commercial.md`](commercial.md) and [`ambient-ci-distribution.md`](ambient-ci-distribution.md).

## Use it with Cursor or coding agents

The Cursor rule is a **local wrapper** around the same **`agentskeptic check`** command and result contract — not a separate integration model.

- Rule file: [`examples/cursor/agentskeptic-check.mdc`](../examples/cursor/agentskeptic-check.mdc)
- Full guide: [`cursor-integration.md`](cursor-integration.md)

Agents should run **`check`** before claiming a workflow is verified; only **`truth_check_verdict: trusted`** supports that claim.

## Optional: share a hosted report

After a local or CI **`check`**, you can optionally publish a persisted public report with **`--share-report-origin <https://your-deployment-origin>`** (HTTPS origin only). See [`shareable-verification-reports.md`](shareable-verification-reports.md).

**`--share-report-origin`** is **not** supported with **`agentskeptic enforce`** batch/quick flows (commercial/stateful enforcement path).

## Later: stateful enforcement

Use **`agentskeptic enforce`** **later** for **commercial / stateful / opt-in** CI enforcement: baselines, drift detection, and acceptance workflows. It may require **`AGENTSKEPTIC_API_KEY`** and license API reachability per [`commercial.md`](commercial.md).

**`enforce`** is **not** required for the first truth check.

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| Missing events file | Fix **`--events`** path; ensure NDJSON exists. |
| Missing registry file | Fix **`--registry`** path; commit **`agentskeptic/tools.json`** when ready. |
| Wrong DB / store path | Fix **`--db`** or connection URL; verify read access at verify time. |
| **`not_trusted`** | Determinate mismatch — inspect stderr report and Outcome Certificate; fix state or registry expectations. |
| **`unknown`** | Incomplete evidence — add observations, witnesses, or narrow workflow scope. |
| Works locally, fails in CI | Align paths, workflow id, and **`npx agentskeptic@latest`** inputs; compare Action **`extra-args`** to local CLI. |
| Accidentally ran **`enforce`** | Use **`agentskeptic check`** for the default stateless path; reserve **`enforce`** for commercial/stateful enforcement (see [`commercial.md`](commercial.md)). |

## Telemetry and privacy

Local **`agentskeptic check`** runs offline. Anonymous product-activation telemetry is **opt-in** and **best effort**: it never affects verification results, stdout, stderr, or exit codes, and it never sends events, registry, certificate body, human report, file paths, or secrets. Set **`AGENTSKEPTIC_TELEMETRY=0`** to force it off. Boundary, fields, and operator queries: [`activation-telemetry-review.md`](activation-telemetry-review.md) and [`funnel-observability.md`](funnel-observability.md).

## Next steps

- **Framework verification recipes:** [`integrate.md#framework-verification-recipes`](integrate.md#framework-verification-recipes)
- **Full integration guide:** [`integrate.md`](integrate.md)
- **GitHub Actions ambient contract:** [`ambient-ci-distribution.md`](ambient-ci-distribution.md)
- **Cursor integration:** [`cursor-integration.md`](cursor-integration.md)
- **Shareable reports:** [`shareable-verification-reports.md`](shareable-verification-reports.md)
- **Commercial enforcement APIs:** [`commercial.md`](commercial.md)
- **Telemetry and privacy:** [`activation-telemetry-review.md`](activation-telemetry-review.md)
