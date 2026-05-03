---
name: cloud-agent-runbook
description: "AgentSkeptic Cloud agent runbook for setup, app execution, feature flags, and validation workflows."
summary: "Run and test this repo in Cursor Cloud"
metadata:
  priority: 10
  pathPatterns:
    - "package.json"
    - "src/**"
    - "test/**"
    - "website/**"
    - "docs/**"
---

# AgentSkeptic Cloud Agent Runbook

Use this skill immediately when a task requires running, testing, or validating this repository in Cursor Cloud.

## 0. Cloud setup and login state

- Work from the repo root. This repo expects Node.js `22.x || 24.x`; `node:sqlite` requires Node `>=22.13`.
- Install once if dependencies are missing: `npm install`. Do not run package upgrades unless the task requires dependency work.
- GitHub CLI is usually authenticated but read-only in Cloud. Check with `gh auth status`; use the PR management tool for PR writes.
- No npm, Vercel, Stripe, or Supabase login is needed for normal local validation. Use MCP tools for Stripe/Supabase tasks when available; use Vercel login only for explicit deployment/platform work.
- Preserve unrelated dirty files. At session start this repo may already have generated or user-owned changes.

## 1. Kernel, CLI, and SQLite verification

Start here for most product, CLI, schema, and verification-engine changes.

Setup:

```bash
npm run build
```

Fast local gates:

```bash
npm run test:node:sqlite
npm run test:vitest -- src/telemetry/postProductActivationEvent.test.ts
node --test test/cli.test.mjs
```

End-to-end CLI smoke checks:

```bash
npm run partner-quickstart
node dist/cli.js check --workflow-id wf_complete --events examples/events.ndjson --registry examples/tools.json --db examples/demo.db
node dist/cli.js loop --workflow-id wf_complete --events examples/events.ndjson --registry examples/tools.json --db examples/demo.db
```

Use `npm run test:node:sqlite` when touching `src/**`, `schemas/**`, `scripts/**`, `test/*.test.mjs`, CLI stdout/stderr behavior, or docs guarded by node tests. Add new `test/*.test.mjs` files to `test/suites.mjs`.

## 2. Website app and route checks

Website code lives in `website/` and runs through the workspace script:

```bash
npm run check:web-demo-prereqs
npm run dev
```

For Cloud agents, start `npm run dev` in tmux and leave it running. Default origin is `http://127.0.0.1:3000`.

Minimal route probes after the dev server is ready:

```bash
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/verify
curl -i http://127.0.0.1:3000/llms.txt
curl -i http://127.0.0.1:3000/openapi-commercial-v1.yaml
curl -sS -X POST http://127.0.0.1:3000/api/demo/verify -H 'content-type: application/json' --data '{"scenarioId":"wf_complete"}'
curl -sS -X POST http://127.0.0.1:3000/api/verify -H 'content-type: application/json' --data '{"eventsNdjson":"{\"schemaVersion\":1,\"workflowId\":\"wf_missing\",\"seq\":0,\"type\":\"tool_observed\",\"toolId\":\"crm.upsert_contact\",\"params\":{\"recordId\":\"missing\",\"fields\":{\"name\":\"Missing\"}}}"}'
```

Targeted website Vitest examples from repo root:

```bash
npm run test:vitest -w agentskeptic-web -- __tests__/public-report-post.route.test.ts
npm run test:vitest -w agentskeptic-web -- __tests__/integrate-page-structure.test.ts
npm run test:vitest -w agentskeptic-web -- __tests__/registry-draft
```

Use `website/__tests__/ci-website-gate.modules.json` and `website/__tests__/decision-readiness-gate.modules.json` to choose focused website suites. For TSX/UI edits, also run the app in a browser and capture a walkthrough artifact.

## 3. Website env, feature flags, and mocks

For local dev, many public/static routes work without Postgres because DB clients connect lazily. Any route that actually queries SQL needs local disposable Postgres env in `website/.env`:

```bash
cp website/.env.example website/.env
npm run db:migrate -w agentskeptic-web
npm run db:migrate:telemetry -w agentskeptic-web
```

Important local flags:

- `AUTH_SECRET` / `NEXTAUTH_SECRET`: required for full `next build`; use a 32+ char dummy in local tests.
- `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000`: useful for local markup parity; production must match the canonical origin.
- `AGENTSKEPTIC_TELEMETRY=0`: disables optional CLI activation telemetry posts.
- `AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB=1`: sends telemetry-tier funnel writes to `TELEMETRY_DATABASE_URL`.
- `AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE=1`: intentionally forces selected telemetry/API write routes to return unavailable; use only to test freeze behavior.
- `PUBLIC_VERIFICATION_REPORTS_ENABLED=1`: enables public verification-report ingestion routes.
- `REGISTRY_DRAFT_ENABLED=1`: enables `POST /api/integrator/registry-draft`; use `OPENAI_API_KEY` for hosted mode or `draftProvider=local_ollama` with `AGENTSKEPTIC_DRAFT_LOCAL_MODEL` and optional `OLLAMA_HOST`.
- `E2E_COMMERCIAL_FUNNEL=1` and `RESERVE_EMERGENCY_ALLOW=1`: E2E-only switches; never set with `VERCEL_ENV=production`.

Do not point `DATABASE_URL` or `TELEMETRY_DATABASE_URL` at production-like databases. Non-production processes enforce the core database boundary.

## 4. Commercial, API, and public distribution checks

Use these when touching commercial activation, OpenAPI, pricing, marketing copy, public anchors, or website DB-backed behavior:

```bash
npm run validate-commercial
npm run verify:web-marketing-copy
npm run check:public-product-anchors
npm run check:integrate-activation-shell
npm run check:partner-quickstart
```

`npm run validate-commercial` expects Postgres `DATABASE_URL` and `TELEMETRY_DATABASE_URL` via `website/.env`; skipped DB-backed tests are not a pass. It also uses a lock under `artifacts/`, so run only one instance per checkout.

OpenAPI/API drift checks:

```bash
npm run build
npm run test:vitest -w agentskeptic-web -- __tests__/openapi-commercial.contract.test.ts
node --test test/openapi-contract-pointer.test.mjs
```

Public distribution sync is anchored by `docs/public-distribution.md`, root `llms.txt`, `schemas/openapi-commercial-v1.yaml`, and the contract manifest files.

## 5. Python and conformance area

Use this only when touching `python/**`, conformance fixtures, or runtime parity:

```bash
npm run conformance:ts
cd python && python -m agentskeptic_conformance.run
npm run conformance:validate
npm run conformance:all
```

For Python verification examples:

```bash
pip install -e "python/[dev]"
python examples/python-verification/run_partner_kernel_demo.py
```

## 6. Choosing the right validation workflow

- Docs-only change: run a narrow text/contract check when available, otherwise `npm run build` is enough evidence.
- CLI/kernel change: `npm run build`, `npm run test:node:sqlite`, and one CLI smoke command that exercises the changed path.
- Website route or API change: targeted website Vitest, `npm run dev` route checks with `curl`, and browser walkthrough for UI.
- Commercial/telemetry/funnel change: local Postgres env, migrations, targeted Vitest, then `npm run validate-commercial` when feasible.
- Public distribution or generated-anchor change: run the documented sync/check command and commit generated artifacts.

## 7. Updating this skill

When a Cloud agent discovers a new reliable setup trick, route probe, missing env var, flaky-test workaround, or faster targeted command:

1. Add the smallest practical instruction to the relevant section.
2. Prefer copy-paste commands over prose.
3. Note whether the command requires Postgres, a dev server, browser testing, or external credentials.
4. Remove stale workarounds once the underlying issue is fixed.
5. Keep this skill focused on execution and validation; product semantics belong in `docs/`.
