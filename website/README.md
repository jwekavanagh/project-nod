# AgentSkeptic — website

> Non-normative implementation guide. For normative commercial semantics, see `docs/commercial.md`. For normative API contract, see `schemas/openapi-commercial-v1.yaml`.

## Run locally (recommended)

```bash
# From repo root (after npm install)
cd website
copy .env.example .env   # then edit DATABASE_URL, TELEMETRY_DATABASE_URL (second Postgres for funnel telemetry + product-activation), AUTH_SECRET, etc.
npm run db:migrate
npm run db:migrate:telemetry
npm run dev
```

Open **http://127.0.0.1:3000** (not only `localhost` if your env binds oddly).

**Magic link send rate limits** (per-email and per-IP caps, Postgres-backed): see **[`docs/website-magic-link-rate-limit.md`](../docs/website-magic-link-rate-limit.md)**.

**Security, env, webhooks, CSP, and canonical origin contracts:** see **[`docs/website-security-and-operations.md`](../docs/website-security-and-operations.md)**.

Use **`npm run dev`** for day-to-day work. It runs the **Turbopack** dev server (`next dev --turbopack`) for faster cold starts and HMR than the default dev bundler. Production builds use **Webpack** explicitly: **`next build --webpack`**. (Next.js 16 defaults `next build` to **Turbopack**, which is not a good match for this app’s instrumentation and Node file APIs on Vercel; Webpack remains the supported production path.)

Use **`npm run build` + `npm run start`** only when you need a production-like run.

## Which CI runs when

All pushes and all pull requests run the **same** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) workflow (no path filters). That includes **CodeQL**, root **`test`** (Postgres + `test:ci` + conformance), **`commercial`** (build, LangGraph embeds, doc-claim URLs, `validate-commercial`, `verify:web-marketing-copy`), **Python** (pytest, timed smoke, Docker image), PR-only **Conventional Commits** and **Release preview**, and a **`main`‑only** **Vercel production** job after the rest succeed.

Production still **does not** auto-deploy on push: `website/vercel.json` keeps `git.deploymentEnabled.main: false`; **only** GitHub Actions `vercel deploy` on green `main` promotes production.

## If `next build` fails with `EBUSY` (Windows)

Another process is locking `website/.next` (common with **OneDrive** under `OneDrive\projects\...`).

1. Stop any running `next start` / `next dev` (Ctrl+C).
2. Close anything that might scan the folder (optional: pause OneDrive sync for this directory).
3. Delete the cache and rebuild:

   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   npm run build
   ```

4. If it still fails, keep using **`npm run dev`** (no full trace step like production build).

## Vercel / CI monorepo tracing

**Install + lockfile:** The Vercel project should use **Root Directory = `website`**. `website/vercel.json` sets **`installCommand`: `cd .. && npm ci`** so installs use the **monorepo root** `package-lock.json` (npm workspaces). That removes the need for `NEXT_IGNORE_INCORRECT_LOCKFILE`. If the Vercel project root is the **repository root** instead, change or remove `installCommand` in the dashboard so installs are not `cd ..` from the wrong place.

**Production** deploys: pushes to `main` no longer auto-deploy (see `vercel.json` `git.deploymentEnabled` for `main`). After [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) trust gates pass on `main`, the workflow runs **`npx -y vercel@52 deploy --prod --yes --logs`** from the **repo root** (remote build on Vercel, not `vercel build` on the runner). Do not add `--cwd website` when the Vercel project’s Root Directory is already `website`, or the CLI path becomes `website/website`. Add repo secrets **`VERCEL_TOKEN`**, **`VERCEL_ORG_ID`**, and **`VERCEL_PROJECT_ID`** (from [Vercel’s GitHub Actions guide](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel), same as a local `vercel link` in `website`). If the CLI deploy ever mis-packages the monorepo, use a [Deploy Hook](https://vercel.com/kb/guide/set-up-and-use-deploy-hooks-with-vercel-and-headless-cms) (`curl -X POST …`) as the job instead (build then matches a normal Git push).

Set env **`NEXT_CONFIG_TRACE_ROOT=1`** on the **website** build so `outputFileTracingRoot` includes the repo root (not needed for local `npm run dev`). Vercel’s production build sets **`VERCEL`/`VERCEL_ENV`** as usual; do not rely on a GitHub `VERCEL=1` for production behavior.

## Engine build, demo API, and fixtures

The **`/verify`** flow calls `POST /api/verify`, which runs the same `verifyWorkflow` engine as the CLI against repo **`examples/`** files. Default entry payload is the bundled **`wf_missing`** line (see SSOT).

- From **repo root**, build the engine before relying on the demo API or running **`npm run build`** inside `website/`:

  ```bash
  npm run build
  ```

  Or build engine + site in one step:

  ```bash
  npm run build:website
  ```

- **Preflight** (Node ≥ 22.13, `node:sqlite`, fixture files): from repo root run **`npm run check:web-demo-prereqs`** (also run during **`npm run validate-commercial`**, before **`scripts/pack-smoke-commercial.mjs`**; ad hoc check: **`npm run pack-smoke`** from repo root).

Architecture, contracts, and operator checklist: **[`docs/website-product-experience.md`](../docs/website-product-experience.md)**.

**First-run verification (repo root):** `npm run partner-quickstart` or **`npm run first-run-verify`** (see root `package.json`). **`/integrate`** is static activation copy in the Next app; integrator SSOT remains **[`docs/partner-quickstart-commands.md`](../docs/partner-quickstart-commands.md)** and **[`docs/first-run-integration.md`](../docs/first-run-integration.md)** in the repo.

## Commercial operator env (Stripe, webhooks, account APIs)

Required for the licensed website surface: **`DATABASE_URL`**, **`STRIPE_SECRET_KEY`**, **`STRIPE_WEBHOOK_SECRET`**, all **`STRIPE_PRICE_*`** (monthly + yearly base) and **`STRIPE_OVERAGE_*`** (metered) keys listed in [`config/commercial-plans.json`](../config/commercial-plans.json), optional **`CRON_SECRET`** (overage usage report route), **`NEXT_PUBLIC_APP_URL`**, **`AUTH_SECRET`**, **`CONTACT_SALES_EMAIL`** (bare email — `website/.env.example`). Use **`../scripts/stripe-bootstrap.mjs`** to print env lines in Stripe test mode.

Forward Stripe webhooks to **`/api/webhooks/stripe`** (local: `stripe listen --forward-to <BASE_URL>/api/webhooks/stripe`; use the printed secret as **`STRIPE_WEBHOOK_SECRET`**).

Normative contracts (webhook event list, Checkout vs Billing Portal, account **`commercial-state`** and **`billing-portal`** routes, reserve **`BILLING_PRICE_UNMAPPED`**, emergency flag semantics): **[`docs/commercial.md`](../docs/commercial.md)** — *Commercial layer — single source of truth*.

**Website Vitest:** from the repo root, **`npm run validate-commercial`** enforces **`DATABASE_URL`**, runs migrate in **`website/`**, then full website Vitest, then **`scripts/pack-smoke-commercial.mjs`** and **`npm run build`** to restore OSS **`dist/`**.

**Local integration DBs:** `vitest.setup.ts` loads **`website/.env`** when the file exists (same merge rule as **`scripts/db-migrate.mjs`**: only keys that are missing or empty in `process.env` are set). That way **`npm run verify:decision-readiness`** (and other DB-backed website suites) see **`DATABASE_URL`** and **`TELEMETRY_DATABASE_URL`** from your gitignored `.env` without pre-exporting them in the shell. **Production / hosted CI** keep using platform-injected env only (no `.env` on the server). Operator KPI SQL is defined only in **`docs/growth-metrics.md`** and is not executed by those Vitest gates.

**`RESERVE_EMERGENCY_ALLOW=1`:** see SSOT — waives inactive-subscription checks only where documented; does not bypass **`BILLING_PRICE_UNMAPPED`**.

## Root package `prepublishOnly` (commercial CLI)

The repo root **`package.json`** runs **`prepublishOnly` → `node scripts/build-commercial.mjs`**. That commercial TypeScript build **requires** **`COMMERCIAL_LICENSE_API_BASE_URL`** set to your deployed site origin (the base URL for **`/api/v1/usage/reserve`**) so **`scripts/write-commercial-build-flags.mjs`** can embed **`LICENSE_API_BASE_URL`** in **`dist/generated/commercialBuildFlags.js`** (consumed by the CLI preflight module).
