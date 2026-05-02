# AgentSkeptic integrator guide (v2 SSOT)

**Start here:** run **one truth check** — compare captured tool activity to your database with `agentskeptic check` (CLI) or `AgentSkeptic.check` (TypeScript), then read the **Outcome Certificate** (stdout / return value) and the **`truth_check_verdict`** line on stderr.

Optional accelerator: [/integrate/guided](https://agentskeptic.com/integrate/guided) in the hosted app (this file is the raw integrator SSOT).

Hosted trust capture (blocked-decision records + alerts) lives in **[trust-authority-layer.md](trust-authority-layer.md)**.

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

- **Proof export:** `--proof <dir>` is equivalent to `--write-decision-bundle` (decision evidence bundle; see [decision-evidence-bundle.md](decision-evidence-bundle.md)).
- **Full flag reference:** [agentskeptic.md](agentskeptic.md). **Advanced subcommands** (`activate`, `loop`, `quick`, …): `agentskeptic help advanced`.

### stderr: `truth_check_verdict`

On verdict exits, stderr begins with:

`truth_check_verdict: trusted|not_trusted|unknown`

| Line value | When |
|------------|------|
| `trusted` | `stateRelation` is `matches_expectations` and high-stakes reliance is `permitted` |
| `not_trusted` | Determinate mismatch (`does_not_match`) |
| `unknown` | Incomplete / not established |

Then the human-readable certificate report (unless `--no-human-report`; the verdict line is still emitted).

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

**Default path (operator):** [README default path](../README.md#default-path-decisiongate-before-you-act)

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

HTTP contract (reference): [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml) — **`VerifyOutcomeRequestV2.activation`**.

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
