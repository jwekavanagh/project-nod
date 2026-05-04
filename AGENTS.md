# AGENTS

Normative **public distribution** and anchor sync: [`docs/public-distribution.md`](docs/public-distribution.md) (same content as https://github.com/jwekavanagh/agentskeptic/blob/main/docs/public-distribution.md).

## Machine-readable product entrypoints

- Committed `llms.txt` at repo root (same bytes as site `/llms.txt` after prebuild sync).
- Raw GitHub `llms.txt`: https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/llms.txt
- OpenAPI YAML (repo raw): https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/schemas/openapi-commercial-v1.yaml
- Verification Contract Manifest (canonical): https://agentskeptic.com/contract/v1.json
- Verification Contract Manifest (repo raw): https://raw.githubusercontent.com/jwekavanagh/agentskeptic/refs/heads/main/schemas/contract/v1.json
- Acquisition page (canonical): https://agentskeptic.com/database-truth-vs-traces
- CI regeneration + drift pathspecs: [`schemas/ci/verification-truth.manifest.json`](schemas/ci/verification-truth.manifest.json) (validated by [`test/verification-truth.closed-drift.contract.test.mjs`](test/verification-truth.closed-drift.contract.test.mjs))

## Cursor Cloud specific instructions

### Architecture

This is an npm workspace monorepo with two packages:
- **Root** (`agentskeptic`): Core verification library + CLI. Framework-agnostic Node.js, ESM, TypeScript.
- **`website/`** (`agentskeptic-web`): Next.js 16 commercial SaaS app (Auth, Stripe, API keys, verification demo).

### Prerequisites

- **Node.js 22.x** (required by `engines` field). Install via nvm: `nvm install 22`.
- **PostgreSQL 16** with two databases: `wfv_website` (core) and `wfv_telemetry` (telemetry).
- The env file at `website/.env` (gitignored) must have `DATABASE_URL` and `TELEMETRY_DATABASE_URL` pointing to local Postgres. See `website/.env.example` for all variables.

### Common commands

| Task | Command | Notes |
|------|---------|-------|
| Install deps | `npm install` (repo root) | Installs root + website workspace |
| Build core | `npm run build` | TypeScript compile + asset generation |
| Run demo | `npm start` | Builds then runs bundled wf_complete/wf_missing verification |
| Website dev | `npm run dev` (repo root) | Delegates to `next dev --turbopack` in website workspace |
| Core vitest | `npx vitest run` (repo root) | Runs `src/**/*.test.ts` and `test/**/*.test.ts` |
| SQLite tests | `npm run test:node:sqlite` | Builds first, then runs node:test suite (fast, no Postgres) |
| Website vitest | `npm run test:vitest -w agentskeptic-web` | Needs `DATABASE_URL` + `TELEMETRY_DATABASE_URL` |
| Full CI gate | `npm test` (or `npm run verification:truth`) | Requires Postgres env vars; see `docs/testing.md` |
| Full CI gate (local env file) | `npm run verification:truth:local` | Loads **`website/.env`** then runs the same `verification:truth` as CI; do not copy `website/.env` to repo root |
| DB migrate | `npm run db:migrate` / `npm run db:migrate:telemetry` (from `website/`) | Requires `DATABASE_URL`/`TELEMETRY_DATABASE_URL` in env or `website/.env` |

### Gotchas

- `npm run build` must complete before the CLI (`node dist/cli.js`) or website demo API (`/api/verify`) work.
- The website migration scripts (`db-migrate.mjs`) load `website/.env` but only for keys not already in `process.env`. If env vars are not exported in the shell, the `.env` file must exist.
- The commit hook (`.husky/commit-msg`) runs `commitlint` for Conventional Commits. Use `--no-verify` to skip if needed, but CI enforces the same rules on PRs.
- PostgreSQL must be running before migrations or website dev. Start with: `pg_ctlcluster 16 main start`.
- `src/planTransition.test.ts` has a known timeout-sensitive integration test that may flake in resource-constrained environments. This is pre-existing, not a setup issue.
