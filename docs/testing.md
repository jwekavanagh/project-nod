# Verification (canonical gate)

All merge-gated ordering lives in [`scripts/verification-truth.mjs`](../scripts/verification-truth.mjs), which loads [`schemas/ci/verification-truth.manifest.json`](../schemas/ci/verification-truth.manifest.json) and runs regeneration, `git diff`, structural checks, Postgres-backed distribution steps, then the journey tail in [`scripts/verification-truth-stages.mjs`](../scripts/verification-truth-stages.mjs).

`package.json` exposes **`npm run verification:truth`** (and **`npm test`** / **`npm run test:ci`** as identical aliases); **no** raw `test/…/*.mjs` paths are embedded in `package.json` scripts (see `test/no-handrolled-node-test-lists.mjs`).

## Commands

| Command | Meaning |
|--------|---------|
| `npm run verification:truth` | Full gate (same as `npm test` and `npm run test:ci`) |
| `npm run test:node:sqlite` | Quick SQLite `node:test` batch after `npm run build` |
| `npm run test:postgres` | Postgres `node:test` batch with `scripts/pg-ci-init.mjs` |
| `npm run test:workflow-truth-contract` | Run CI workflow-truth postgres contract file only |
| `npm run conformance:all` | Build TS/Python conformance artifacts, canonicalize, parity-check, and compute capability states |
| `npm run conformance:gate` | Enforce supported-scope 100% behavior + scenario-shape gates |
| `npm run docs:check:capabilities` | Assert generated capability matrix is up to date in docs |

**Decision-readiness website-only Vitest:** run from repo root (example):

`npm run test:vitest -w agentskeptic-web -- __tests__/…` with modules listed in `website/__tests__/decision-readiness-gate.modules.json` (see that JSON for the exact file set).

`node --test` file membership is the single registry in [`test/suites.mjs`](../test/suites.mjs). Website Vitest file lists for the CI gate are JSON next to the website tests: `website/__tests__/ci-website-gate.modules.json` (read by `verification-truth-stages.mjs`).

## GitHub Actions

[`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs on every push and PR (no path filters). The **`verification`** job runs **`npm run verification:truth`** once (after checkout, Postgres env, LangGraph oracle fixture **`npm ci`**, and setup). The same workflow also runs **CodeQL**, **Python** (pytest, timed smoke, Docker), PR-only Conventional Commits and release preview, and **`main`-only** Vercel production after those jobs succeed.

**Postgres env** for the gate: `POSTGRES_ADMIN_URL`, `POSTGRES_VERIFICATION_URL`, `DATABASE_URL`, and `TELEMETRY_DATABASE_URL` (see [`ci.yml`](../.github/workflows/ci.yml) and README).

## Audiences

- **Engineer:** add a new `test/*.test.mjs` by editing [`test/suites.mjs`](../test/suites.mjs) (sqlite or postgres) so `test/suite-coverage.mjs` passes.  
- **Integrator / operator:** use the table above; use [`docs/core-database-boundary.md`](core-database-boundary.md) for website DB split in CI.  
- **Reviewer:** ensure `package.json` scripts never reintroduce `test/…/*.mjs` fragments.
