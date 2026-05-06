# First truth check

Run one stateless AgentSkeptic truth check and understand the result.

**Default first run:** `agentskeptic check`.

Use **`check`** for the first stateless truth check. It does **not** require an **`AGENTSKEPTIC_API_KEY`** or a license server.

Optional preview: **`agentskeptic quick`** can give a cheap SQL-oriented preview on captured activity; graduate to **`check`** when you need contract-grade verification (see [`integrate.md`](integrate.md)).

For TypeScript, the same contract is **`await skeptic.check({ … })`** / **`AgentSkeptic.check`** — stdout is still the Outcome Certificate-shaped result from the engine (see [`integrate.md`](integrate.md) for SDK wiring).

## What you get

- **stdout:** one **Outcome Certificate** (machine JSON).
- **stderr:** human-readable report; on verdict exits it **begins** with **`truth_check_verdict: trusted`**, **`not_trusted`**, or **`unknown`** (then the rest of the report).

Logs, traces, CI green, wrapper summaries, or agent claims are **not** the source of truth when they disagree with the Outcome Certificate or the verdict line.

## Before you start

You supply:

| Input | Role |
|--------|------|
| **Workflow id** | `--workflow-id` — identifies the workflow under verification (never inferred). |
| **Events / observations** | NDJSON file: **`--events`** — structured tool activity to replay (e.g. `examples/events.ndjson`). |
| **Tools registry** | JSON registry: **`--registry`** — maps tools and verification targets (e.g. `examples/tools.json`). |
| **State store / witnesses** | At least one readable verification target — commonly **`--db`** for SQLite; Postgres URLs and registry-defined HTTP/object/vector/Mongo witnesses per your setup (see [`integrate.md`](integrate.md)). |

AgentSkeptic does **not** auto-discover these paths unless you use documented defaults (for example **`--project`** with the conventional layout). Pass paths explicitly when yours differ.

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

**stderr:** human report; on verdict exits the first line is one of:

```text
truth_check_verdict: trusted
truth_check_verdict: not_trusted
truth_check_verdict: unknown
```

| Verdict | Meaning |
|---------|---------|
| **`trusted`** | The checked outcome matched expected downstream state — only this verdict means you can rely on the verified workflow for this run. |
| **`not_trusted`** | Determinate mismatch or missing required state — do **not** claim verified; fix the mismatch. |
| **`unknown`** | Evidence incomplete or not established — do **not** claim verified; collect evidence or narrow scope. |

If anything else says “verified” but the Outcome Certificate or **`truth_check_verdict`** disagrees, trust the certificate and verdict.

## Add it to GitHub Actions

<!-- agentskeptic-ci-summary-legend:v1 -->
The composite action’s GitHub **job summary** includes a **Verdict meanings** block (trusted / **not_trusted** / unknown) before the streamed stderr excerpts — operators should read **[`ambient-ci-distribution.md`](ambient-ci-distribution.md)** alongside this page.

After the local command works, wire the same CLI contract in CI.

- Default OSS path: composite action **[`../.github/actions/agentskeptic-check/action.yml`](../.github/actions/agentskeptic-check/action.yml)** — default **`mode`** is **`check`**; **no** **`AGENTSKEPTIC_API_KEY`** on that path.
- Example workflow: **[`examples/github-actions/agentskeptic-check.yml`](../examples/github-actions/agentskeptic-check.yml)**.
- In **this** repository you can use a relative path:

```yaml
- uses: actions/checkout@v4

- uses: ./.github/actions/agentskeptic-check
  with:
    workflow-id: wf_complete
    events: examples/events.ndjson
    registry: examples/tools.json
    db: examples/demo.db
```

In another repository, pin the upstream action (not Marketplace):  
`uses: OWNER/agentskeptic/.github/actions/agentskeptic-check@<ref>`  
and pass the same inputs / **`extra-args`** as needed.

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

- **Full integration guide:** [`integrate.md`](integrate.md)
- **GitHub Actions ambient contract:** [`ambient-ci-distribution.md`](ambient-ci-distribution.md)
- **Cursor integration:** [`cursor-integration.md`](cursor-integration.md)
- **Shareable reports:** [`shareable-verification-reports.md`](shareable-verification-reports.md)
- **Commercial enforcement APIs:** [`commercial.md`](commercial.md)
- **Telemetry and privacy:** [`activation-telemetry-review.md`](activation-telemetry-review.md)
