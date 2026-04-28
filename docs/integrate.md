# AgentSkeptic integrator guide (v2 SSOT)

**Start here (canonical):** [golden-path.md](golden-path.md) (executable Next.js + Postgres reference with deterministic pass/fail verification).

Optional accelerator: [guided-first-verification.md](guided-first-verification.md) (browser flow for draft + quick ingest generation).

This document is the **single supported starting point** for shipping AgentSkeptic in application code. Older split guides are stubs that redirect here.

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

Legacy exports (`createDecisionGate`, `verifyWorkflow`, …) remain **deprecated** wrappers; see [`docs/migrate-2.md`](migrate-2.md).

### Next.js (App Router)

```typescript
import { AgentSkeptic } from "agentskeptic";
import { createNextRouteHandler } from "agentskeptic/next";
import { join } from "node:path";

const skeptic = new AgentSkeptic({
  registryPath: join(process.cwd(), "agentskeptic", "tools.json"),
  databaseUrl: process.env.DATABASE_URL ?? join(process.cwd(), "demo.db"),
});

export const POST = createNextRouteHandler(skeptic, async (gate, req) => {
  const body = await req.json();
  for (const ev of body.events ?? []) gate.appendRunEvent(ev);
  return await gate.evaluateCertificate();
});
```

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
