# AgentSkeptic integrator guide (v2 SSOT)

**Start here (canonical):** [golden-path.md](golden-path.md) (executable Next.js + Postgres reference with deterministic pass/fail verification).

Optional accelerator: [/integrate/guided](https://agentskeptic.com/integrate/guided) in the hosted app (raw doc: **[integrate.md](integrate.md)** — this file).

This document is the **single supported starting point** for shipping AgentSkeptic in application code. Hosted trust capture (blocked-decision records + alerts) lives in **[trust-authority-layer.md](trust-authority-layer.md)**. Older split guides are stubs that redirect here.

## Activation

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

## TypeScript (npm)

### Install

```bash
npm install agentskeptic
```

### Golden path stack (default)

AgentSkeptic ships one fully-supported onboarding reference: **Next.js (App Router) + Postgres**.
Use [`golden-path.md`](golden-path.md) for the complete copy-and-run path (reference app + deterministic verify).

All other stacks are **contract-based** only: supported by schemas and verification contracts, but not first-run
golden onboarding.

### Scaffold (contract-based local bootstrap)

Local scaffold commands remain available for quick setup, but they are not the canonical production onboarding path:

```bash
npx agentskeptic init --framework next --database sqlite --yes
npx agentskeptic init --framework none --database sqlite --yes
```

### SDK surface

- `AgentSkeptic` — [`src/sdk/AgentSkeptic.ts`](../src/sdk/AgentSkeptic.ts)
- `AgentSkepticError` — unified errors with stable codes (`schemas/agentskeptic-error-codes.json`)
- `agentskeptic/next` — `createNextRouteHandler` for App Router POST handlers

Integrations should **`import { AgentSkeptic } from "agentskeptic"`**; legacy root-callable helpers were removed in **v4**. See [`migrate-2.md`](migrate-2.md) for replacements.

### Next.js (App Router)

```typescript
import { AgentSkeptic, BufferSink } from "agentskeptic";
import { createNextRouteHandler } from "agentskeptic/next";
import { join } from "node:path";

const skeptic = new AgentSkeptic({
  registryPath: join(process.cwd(), "agentskeptic", "tools.json"),
  databaseUrl: process.env.DATABASE_URL ?? join(process.cwd(), "demo.db"),
});

export const POST = createNextRouteHandler(skeptic, async (gate, req) => {
  const body = (await req.json()) as {
    workflowId?: string;
    observations?: Array<{ toolId: string; params: Record<string, unknown> }>;
  };
  const sink = new BufferSink();
  const emitter = skeptic.createEmitter({
    workflowId: body.workflowId ?? "api",
    sink,
    defaultToolObservedSchemaVersion: 2,
  });
  for (const obs of body.observations ?? []) {
    await emitter.emitToolObserved({ toolId: obs.toolId, params: obs.params });
  }
  await emitter.finalizeRun();
  for (const ev of sink.snapshot()) gate.appendRunEvent(ev);
  gate.assertEmissionQuality();
  return await gate.evaluateCertificate();
}, { strictEmissionQuality: true });
```

Raw event objects are still accepted by low-level replay surfaces for compatibility, but they are not the recommended integration path.

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
