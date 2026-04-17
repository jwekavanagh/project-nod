# AGENTS

Normative **public distribution**, anchor sync, and consumer pipeline contracts: [`docs/public-distribution-ssot.md`](docs/public-distribution-ssot.md) (same content as https://github.com/jwekavanagh/agentskeptic/blob/main/docs/public-distribution-ssot.md).

## Machine-readable product entrypoints

- Committed `llms.txt` at repo root (same bytes as site `/llms.txt` after prebuild sync).
- Raw GitHub `llms.txt`: https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/llms.txt
- OpenAPI YAML (repo raw): https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/schemas/openapi-commercial-v1.yaml
- Acquisition page (canonical): https://agentskeptic.com/database-truth-vs-traces

## Integration tests and Postgres environment (normative)

**Non-negotiable:** Do **not** run **`npx vitest`** (or any Node test runner) for **website integration tests** that depend on **`DATABASE_URL`** and **`TELEMETRY_DATABASE_URL`** unless both variables are **already set in `process.env`**. If they are missing, those suites **`describe.skipIf`** and you get a **false signal** (skipped is not validated).

**Single supported path (matches CI harness):** from repo root run **`npm run validate-commercial`**. That script merges **`website/.env`** into the environment (see [`scripts/validate-commercial-funnel.mjs`](scripts/validate-commercial-funnel.mjs)) before migrations and Vitest, so Postgres-backed and telemetry tests **execute** instead of skipping.

**Disallowed:** Treating skipped DB-dependent tests as passing; assuming `.env` is auto-loaded for ad-hoc Vitest or IDE runs; using a **repo-root** `.env` as a substitute unless you also load it into the process (this repo’s convention is **`website/.env`**—see [`website/.env.example`](website/.env.example)).

**Rare alternative:** If you must run a **single** Vitest file locally, **`export`** both URLs in the shell first (same values as in `website/.env`), then run Vitest—only when that narrow scope is explicitly required.
