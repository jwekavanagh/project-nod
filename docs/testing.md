# Verification (single orchestrator)

All default and full-CI test ordering lives in [`scripts/verify.mjs`](../scripts/verify.mjs). `package.json` only exposes one-line aliases; **no** `test/…\*.mjs` paths are embedded in `package.json` (enforced by `test/no-handrolled-node-test-lists.mjs`).

## Commands

| Command | Meaning |
|--------|---------|
| `npm test` | `node scripts/verify.mjs --profile=default` |
| `npm run test:ci` | `node scripts/verify.mjs --profile=ci` (Postgres, Playwright, full CI tail) |
| `npm run verify:decision-readiness` | `node scripts/verify.mjs --profile=decision-readiness` (website only) |
| `npm run test:node:sqlite` | `node scripts/verify.mjs --stages=nodeGuards,nodeTestSqlite` (compatibility) |
| `npm run test:postgres` | `node scripts/verify.mjs --stages=nodeTestPostgres` (compatibility) |
| `npm run test:workflow-truth-contract` | `node scripts/verify.mjs --stages=ciWorkflowTruthSingle` |
| `npm run conformance:all` | Build TS/Python conformance artifacts, canonicalize, parity-check, and compute capability states |
| `npm run conformance:gate` | Enforce supported-scope 100% behavior + scenario-shape gates |
| `npm run docs:check:capabilities` | Assert generated capability matrix is up to date in docs |

`node --test` file membership is the single registry in [`test/suites.mjs`](../test/suites.mjs). Website Vitest file lists for the CI gate and decision-readiness are JSON next to the website tests: `website/__tests__/ci-website-gate.modules.json`, `website/__tests__/decision-readiness-gate.modules.json` (arg lists are read by `verify.mjs`).

## `--profile=default` (stages, in order)

1. `build` — `npm run build`  
2. `epistemic` — `npm run check:epistemic-contract-structure`  
3. `vitestRoot` — `npm run test:vitest` (root)  
4. `vitestWebsiteCiGate` — `npm run test:vitest -w agentskeptic-web` with includes from `ci-website-gate.modules.json`  
5. `nodeGuards` — dependency / legacy / surface guard scripts  
6. `nodeTestSqlite` — `node --test` for all `sqliteNodeTestFiles` in `test/suites.mjs` (includes `suite-coverage` and `no-handrolled-node-test-lists`)  
7. `firstRun` — `node scripts/first-run.mjs`  
8. `validateAdoption1` / `adoptionFailureTest` / `validateAdoption2` — adoption validation and failure-injection `node --test`  
9. `partnerQuickstart` … `assurance` — partner, spine, Python, quickstart, assurance  
10. `commercialEnforce` — `node scripts/commercial-enforce-test-harness.mjs` (no `--require-postgres`)  
11. `rebuildOss` / `validateTtfv` / `relatedExists` — rebuild OSS, TTFV, related-exists

## `--profile=ci` (after shared prefix through `assurance`)

Continues with `nodeTestPostgres` (`pg-ci-init` + postgres `node --test` files), `partnerQuickstartPostgres`, `commercialEnforcePostgres` (`--require-postgres`), `playwrightInstall`, `playwright`, then `rebuildOss`, `validateTtfv`, `relatedExists`. **No** unflagged `commercialEnforce` in this profile (replaced by the postgres + `--require-postgres` path).

**GitHub Actions** runs a **unified** [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) on every push and PR (no path filters): the `test` job runs `npm run test:ci` after `npm ci` and `npm ci --prefix test/fixtures/langgraph-node-oracle`. The same workflow also runs **CodeQL**, **commercial** (including `validate-commercial`), **Python** (pytest, timed smoke, Docker), PR-only Conventional Commits and release preview, and **`main`-only** Vercel production after those jobs succeed. `checkout` is always explicit; Node install uses the composite [`.github/actions/setup-node-npm`](../.github/actions/setup-node-npm/action.yml) (Node 22, npm cache, `npm ci` only — no checkout in the composite) so pre-CodeQL grep order stays clear.

**Postgres env** for `test:ci`: `POSTGRES_ADMIN_URL` and `POSTGRES_VERIFICATION_URL` (see README and `ci.yml`).

## Audiences

- **Engineer:** add a new `test/*.test.mjs` by editing [`test/suites.mjs`](../test/suites.mjs) (sqlite or postgres) so `test/suite-coverage.mjs` passes.  
- **Integrator / operator:** use the table above; use [`docs/core-database-boundary.md`](core-database-boundary.md) for website DB split in CI.  
- **Reviewer:** ensure `package.json` scripts never reintroduce `test/…\*.mjs` fragments.
