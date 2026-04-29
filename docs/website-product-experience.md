# Website product experience (SSOT index)

This document explains how the commercial Next.js site works and points to **normative code** for contracts and copy. Do not duplicate guarantee tables or wire schemas here—edit the referenced files.

## Engineer

- **Bundled verifier SSOT:** [`website/src/lib/bundledContractVerify.ts`](../website/src/lib/bundledContractVerify.ts) — `runBundledContractVerify` is the single path for bundled verification (`paste` and `scenarioFile`), calling `verifyWorkflow` from `agentskeptic`, then building + validating Outcome Certificate v1.
- **Fixture resolution:** [`website/src/lib/resolveRepoExamples.ts`](../website/src/lib/resolveRepoExamples.ts) — probes `examples/` under `process.cwd()` and parent (supports dev from `website/` or repo root).
- **HTTP APIs:** [`website/src/app/api/verify/route.ts`](../website/src/app/api/verify/route.ts) and [`website/src/app/api/demo/verify/route.ts`](../website/src/app/api/demo/verify/route.ts) — both return the same success JSON shape and include `x-request-id`.
- **Browser demo surface:** [`website/src/app/verify/page.tsx`](../website/src/app/verify/page.tsx) — canonical paste-run-render experience. Homepage `#try-it` is CTA-only and links here.
- **Wire contract (Zod):** [`website/src/lib/verifyBundled.contract.ts`](../website/src/lib/verifyBundled.contract.ts) — single success/error contract for bundled verify responses.
- **Schema validation export:** [`src/index.ts`](../src/index.ts) re-exports `loadSchemaValidator` for the website and tests.

## Integrator

- **Dual SSOT:** [`docs/partner-quickstart-commands.md`](partner-quickstart-commands.md) (generated) is the **sole** source for copy-paste shell commands. [`docs/first-run-integration.md`](first-run-integration.md) is the **sole** prose SSOT (semantics, guarantees, mistakes). Regenerate commands with **`node scripts/generate-partner-quickstart-commands.mjs`**; CI checks via **`npm run check:partner-quickstart`**.
- **`/integrate` + `/integrate/guided`:** [`website/src/app/integrate/page.tsx`](../website/src/app/integrate/page.tsx) leads with a **Guided: generate registry and quick input** CTA to [`/integrate/guided`](../website/src/app/integrate/guided/page.tsx) (single-surface first verification), then the pack-led `<pre>` with the crossing command from [`config/marketing.json`](../config/marketing.json) (`integratePage.packLedCommand`), requirements, proof, and GitHub links. Deeper steps stay in [`docs/guided-first-verification.md`](../docs/guided-first-verification.md), [`docs/integrate.md`](../docs/integrate.md), and [`docs/first-run-integration.md`](first-run-integration.md).
- **LangGraph reference boundaries:** [`docs/langgraph-reference-boundaries.md`](langgraph-reference-boundaries.md#langgraph-reference-documentation-boundaries) owns the full matrix; linked integrator docs must not duplicate that table shape here.
- **Root `npm test` (website slice):** runs a **filtered** website Vitest invocation (`__tests__/langgraph-reference-primacy.dom.test.tsx`) so LangGraph integrator primacy is checked **without** requiring **`DATABASE_URL`** for the full marketing Vitest suite.
- **Bundled demo scenarios (eight, fixed order in the select):** `wf_missing`, `wf_complete`, `wf_partial`, `wf_inconsistent`, `wf_duplicate_rows`, `wf_unknown_tool`, `wf_dup_seq`, `wf_divergent_retry` — allowlist and `DEMO_SCENARIO_PRESENTATION` in [`website/src/lib/demoScenarios.ts`](../website/src/lib/demoScenarios.ts); Zod in [`website/src/lib/demoVerify.contract.ts`](../website/src/lib/demoVerify.contract.ts).

## Funnel / observability (code normative)

- **Commercial funnel metadata (Zod):** [`website/src/lib/funnelCommercialMetadata.ts`](../website/src/lib/funnelCommercialMetadata.ts) — `reserve_allowed` and `checkout_started` jsonb shapes; used only from reserve and checkout routes.
- **Repeat-day analytics:** [`website/src/lib/funnelObservabilityQueries.ts`](../website/src/lib/funnelObservabilityQueries.ts) — `countDistinctReserveDaysForUser`; do not copy SQL elsewhere.
- **E2E proof:** [`website/__tests__/funnel-observability-chain.integration.test.ts`](../website/__tests__/funnel-observability-chain.integration.test.ts) runs under **`npm run validate-commercial`** (full `vitest run` from `website/`).
- **Migrations:** extending `funnel_event.event` CHECK requires a new `website/drizzle/0002_*.sql` **and** a matching entry in [`website/drizzle/meta/_journal.json`](../website/drizzle/meta/_journal.json).

## Operator

- **Node:** `>= 22.13.0` (website `engines` and `scripts/check-web-demo-prereqs.mjs`).
- **Build:** `npm run build:website` from repo root (builds the engine, then Next).
- **Vercel / serverless:** set `NEXT_CONFIG_TRACE_ROOT=1` so `examples/` and package `schemas/` are traced with the deployment (see [`website/next.config.ts`](../website/next.config.ts)).
- **Preflight:** `npm run check:web-demo-prereqs` — verifies Node, `node:sqlite`, fixture files, and read-only open of `demo.db`. Repo root **`npm run validate-commercial`** runs this after website Vitest (which itself requires **`DATABASE_URL`**, **`TELEMETRY_DATABASE_URL`**, and Drizzle migrate scripts), then **`scripts/pack-smoke-commercial.mjs`** and **`npm run build`** to restore OSS **`dist/`**.
- **Next build auth:** `AUTH_SECRET` (and related env) remain required for full `next build` when API routes that touch auth are analyzed—see [`website/.env.example`](../website/.env.example).
- **Enterprise mailto:** `CONTACT_SALES_EMAIL` — bare email, validated at [`website/next.config.ts`](../website/next.config.ts) load; see [`website/.env.example`](../website/.env.example).

## Product copy

- **Site chrome (header primary links, footer rows, homepage trust strip):** [`website/src/lib/siteChrome.ts`](../website/src/lib/siteChrome.ts) — four link-builder functions (`buildSiteHeaderPrimaryLinks`, `buildSiteFooterProductLinks`, `buildSiteFooterLegalLinks`, `buildHomeTrustStripLinks`) plus **`openapiHrefFromProcessEnv()`** for OpenAPI href resolution. Footer product links include **`/support`**.
- **Homepage (non-commercial sections), CTA labels, test ids, account/integrate strings:** [`website/src/content/productCopy.ts`](../website/src/content/productCopy.ts). **Public commercial + contract copy** (pricing grid, “Commercial terms,” metering clarifier, security quick facts) live in [`website/src/lib/commercialNarrative.ts`](../website/src/lib/commercialNarrative.ts) with data from [`config/commercial-plans.json`](../config/commercial-plans.json) and stable narrative projection from [`config/buyer-truth.v1.json`](../config/buyer-truth.v1.json) ([`website/src/lib/buyerTruth.ts`](../website/src/lib/buyerTruth.ts)). **Operational metering semantics** (`pool`, reserve tiers) remain normative **[`docs/commercial.md`](../docs/commercial.md)** only—buyer-truth deliberately does not restate pooled arithmetic there.
- **Site metadata:** [`website/src/content/siteMetadata.ts`](../website/src/content/siteMetadata.ts) — route-local shells (`integrate`, `security`, `support`, `claim`), **`openGraphImage`**, and related fields. Default **site-wide** title/description/Open Graph text come from [`config/marketing.json`](../config/marketing.json) via [`website/src/lib/marketing.ts`](../website/src/lib/marketing.ts) and [`website/src/app/layout.tsx`](../website/src/app/layout.tsx). The homepage sets its own `metadata` in [`website/src/app/page.tsx`](../website/src/app/page.tsx) using `siteDefaultMetadata` and hero copy from the same file.
- **Public anchors (GitHub, npm, one-liner, keywords):** the same JSON powers [`website/src/lib/publicProductAnchors.ts`](../website/src/lib/publicProductAnchors.ts). **Outbound identity links** (repo, npm, served OpenAPI URL) live in the **footer** product nav — see [`website/src/app/SiteFooter.tsx`](../website/src/app/SiteFooter.tsx) (footer also links **Security & Trust**, Privacy, and Terms). This keeps marketing copy, README, npm `package.json`, and the site aligned without scattering hardcoded `github.com/...` strings.
- **Buyer-truth codegen + gate:** **`npm run codegen:buyer-truth`** refreshes **`website/src/generated/buyerTruthProjection.snap.json`**, the codegen hash module, README **`COMMERCIAL_ENTRY`** interiors, and validates against [`schemas/buyer-truth-v1.schema.json`](../schemas/buyer-truth-v1.schema.json); **`npm run check:buyer-truth`** (also invoked early in **`npm run verification:truth`**) asserts schema anchors, **`docs/commercial.md`** alignment on critical lines, regenerated outputs vs `HEAD`, and Vitest parity.
- **Contracts:** `node scripts/validate-marketing.cjs` (required keys, hero caps, pack-led signature) runs in CI via **`check:primary-marketing`**. `website/__tests__/marketing.config.contract.test.ts` (R2 string rule) and `website/__tests__/marketing-surfaces.contract.test.ts` (rendered HTML includes substrings from the JSON) guard drift. `website/__tests__/marketing-budget.contract.test.ts` enforces a **≥70%** word-count drop vs a committed pre-cutover baseline (terminal transcript excluded).
- **Auth callback hardening:** [`website/src/lib/sanitizeInternalCallbackUrl.ts`](../website/src/lib/sanitizeInternalCallbackUrl.ts) — `emailSignInOptions` is what the sign-in page passes to `signIn("email", …)`.

### Route render order (copy contract)

This section is the human-readable mirror of the Vitest contracts that read rendered HTML via **`siteTestServer`** / **`getSiteHtml`**.

1. **`/`** — Homepage `<main>` stream: **Hero** (primary CTA links to **`/verify`**), then `#try-it` CTA-only section (`HomeVerifyCta`), followed by the existing sections (**What this catches**, **Stakes**, **How it works**, etc.). Homepage does not run verification directly. **`homepage-causality-invariant`** remains enforced for causal wording.
2. **`/database-truth-vs-traces`** — **Product brief** depth layer: `productCopy.productBriefPage` (problem, how verification works, production scenarios, who/limits), required `visitorProblemAnswer` from [`config/marketing.json`](../config/marketing.json), then full `shareableTerminalDemo` transcript, disclaimer, and **Get started** + **Try the demo**; `briefSections` in JSON is an empty list (funnel text lives in `productBriefPage` to keep the global marketing word budget test stable).
3. **`/pricing`** — H1 and stakes from `marketing.json` (via `getPricingPageViewModelFromConfig()`), narrative subtitles, plan rows from the same view model, **`pricing-what-you-get`**, then `<ul aria-label="Commercial terms">` from **`getPricingCommercialTermsBullets`**, then trust band, then `PricingClient` with `data-plan` cards. **Vitest** **`pricing-commercial-terms-html`** still asserts each `<li>` is lead `<strong>` then body. The recommended Team card keeps `data-testid="pricing-recommended-pill"`.
4. **`/account`** — outcome-first **verification control center**: a server card renders [`AccountServerAboveFold.tsx`](../website/src/app/account/AccountServerAboveFold.tsx) from [`website/src/app/account/page.tsx`](../website/src/app/account/page.tsx) (signed-in line, optional masked key summary, `productCopy.accountPage` intro). Below `Suspense`, a **single** client [`AccountClient.tsx`](../website/src/app/account/AccountClient.tsx) `div.card` keeps **fixed** `data-testid` regions in order: **`account-verification-region`** (heartbeat from `funnel_event.event === 'licensed_verify_outcome'` via [`funnelObservabilityQueries.ts`](../website/src/lib/funnelObservabilityQueries.ts), labels from [`accountVerificationActivityUi.ts`](../website/src/lib/accountVerificationActivityUi.ts), prose from [`productCopy.ts`](../website/src/content/productCopy.ts)), **`account-starter-upgrade`**, **`account-subscription-region`**, **`account-usage-region`**, **`account-api-key-region`**, **`account-trust-footnote`**. Issued key shape for tests and leak checks: [`apiKeyCrypto.ts`](../website/src/lib/apiKeyCrypto.ts) (`API_KEY_ISSUED_PATTERN`).
5. **`/integrate`** — exactly one `<main><h1>` whose text matches `siteMetadata.integrate.title` (see **`integrate-page-markup`**).

### Integrator: server-rendered commercial and account copy

Integrators should treat **`commercialNarrative.ts`** + **`commercial-plans.json`** as the source for all buyer-facing commercial strings (and **`productCopy`** + **`config/marketing.json`** for the rest of the site chrome). Long-form semantics remain in **`docs/first-run-integration.md`**. The **`pricing`** and **`account`** routes intentionally duplicate nothing that belongs only in the client bundle.

### Operator: post-change verification

When you change **`config/marketing.json`**, **`productCopy.ts`**, **`config/commercial-plans.json`**, **`commercialNarrative.ts`**, or any route markup covered by the marketing Vitest suite, run **`npm run verify:web-marketing-copy`** from the repository root as the single gate before merging.

### Discovery surfaces (machine + crawl + share)

**Why canonical production URLs:** **`/llms.txt`** (generated) and [`website/src/app/sitemap.ts`](../website/src/app/sitemap.ts) use **`productionCanonicalOrigin`** from [`config/marketing.json`](../config/marketing.json) so machine-readable links stay stable on production even when preview deploys use a different `NEXT_PUBLIC_APP_URL`.

- **Marketing / acquisition:** [`config/marketing.json`](../config/marketing.json) drives the README **`discovery-readme-title`** and discovery fold (sync-written), extended **`/llms.txt`**, and site hero copy. **Discovery routing and merge-gate metadata:** [`docs/discovery-surfaces.md`](../docs/discovery-surfaces.md). **Homepage `/`** uses [`website/src/lib/marketing.ts`](../website/src/lib/marketing.ts) plus [`website/src/content/productCopy.ts`](../website/src/content/productCopy.ts) for section bodies. Primary nav in [`website/src/app/SiteHeader.tsx`](../website/src/app/SiteHeader.tsx) maps `buildSiteHeaderPrimaryLinks` (**Product brief**, **Get started** `/integrate`, **Try** `/verify`, **Learn** `/guides`, **Problems** `/problems`, **Compare** `/compare`, **Pricing**, external **CLI**), then auth. CLI **`cliFollowupLines`** footer uses sync-generated **`src/publicDistribution.generated.ts`**. Validation: [`scripts/validate-marketing.cjs`](../scripts/validate-marketing.cjs) (not a large JSON Schema file). Do not hand-edit prose inside README sync markers; change JSON and run **`npm run emit-primary-marketing`** (or **`sync:public-product-anchors`**).
- **Generated (gitignored, do not hand-edit):** [`website/public/llms.txt`](../website/public/llms.txt) and [`website/public/openapi-commercial-v1.yaml`](../website/public/openapi-commercial-v1.yaml) — written by [`scripts/emit-primary-marketing.cjs`](../scripts/emit-primary-marketing.cjs). **`website` `prebuild`** runs [`scripts/sync-website-ssot.mjs`](../scripts/sync-website-ssot.mjs) (which includes **`npm run sync:public-product-anchors`**) from the repo root so these exist before `next build`.
- **Committed static asset:** [`website/public/og.png`](../website/public/og.png) — Open Graph / Twitter preview image; regenerate with `node website/scripts/export-og-from-lockup.cjs` after changing [`mark.png`](../website/public/brand/mark.png) (see [`docs/brand-system.md`](brand-system.md)).
- **Next.js routes:** [`website/src/app/sitemap.ts`](../website/src/app/sitemap.ts) (merges sorted markdown **`route`** values from `listDiscoveryRoutes()`, plus **`/guides`**, **`/problems`**, **`/compare`**, and other pinned marketing URLs—after **`/integrate`**, before **`/support`**; **`/auth/signin`** is intentionally omitted), [`website/src/app/robots.ts`](../website/src/app/robots.ts) — crawl hints at `/sitemap.xml` and `/robots.txt`. **`GET /examples`** (hub only) **308** redirects to **`/guides`**; **`GET /company`** **308** redirects to **`/support`** ([`website/next.config.ts`](../website/next.config.ts)).
- **HTML head:** [`website/src/app/layout.tsx`](../website/src/app/layout.tsx) sets `metadataBase`, Open Graph + Twitter card (image from [`website/src/content/siteMetadata.ts`](../website/src/content/siteMetadata.ts)), and one `application/ld+json` **`SoftwareApplication`** block (repo + npm in `sameAs`). Favicons: [`website/src/app/icon.png`](../website/src/app/icon.png) and [`apple-icon.png`](../website/src/app/apple-icon.png) (generated from the canonical `mark.png`). Per-route **`alternates.canonical`** lives on leaf `page.tsx` files (see `website/__tests__/metadata-matrix.test.ts`). Body typography uses **`next/font/google`** (`Inter`, variable `--font-sans` on `<html>`, inherited by [`website/src/app/globals.css`](../website/src/app/globals.css) for `body`, headings, and `.site-logo`).
- **npm registry fields:** Root [`package.json`](../package.json) **`description`**, **`keywords`**, **`repository`**, **`bugs`**, and **`homepage`** are written by sync from **`config/marketing.json`**. **`identityOneLiner`** remains the precise line for OpenAPI / README anchor list / `llms.txt` Summary — not the npm `description`. Run **`npm run emit-primary-marketing`** after editing the JSON file.

**Integrator:** For tooling or assistants, prefer fetching **`/llms.txt`** and **`/openapi-commercial-v1.yaml`** on the canonical site origin over scraping prose docs; when the canonical site is unavailable, use the **repo-raw** URLs listed under **`## Primary links`** in committed root **`llms.txt`**.

### Operator checklist — first inbound links

1. Pin a **GitHub Release** or **Discussion** (or the default README view) so evaluators land on the discovery fold or **`/database-truth-vs-traces`** on the canonical deployment.
2. Confirm the **npm** package page renders the same README discovery fold (published tarball root `README.md`).
3. After production deploy, verify **`{canonical}/llms.txt`**, **`{canonical}/database-truth-vs-traces`**, **`{canonical}/guides`**, and **`{canonical}/security`** return **200** and that `llms.txt` lists both canonical and repo-raw OpenAPI / `llms.txt` links and **`## Indexable guides`**.

## Holistic quality bar (a11y + CI gate)

Normative implementation: skip link ([`website/src/components/SkipToMainContent.tsx`](../website/src/components/SkipToMainContent.tsx)), live regions ([`website/src/components/LiveStatus.tsx`](../website/src/components/LiveStatus.tsx)), focus and reduced-motion CSS ([`website/src/app/globals.css`](../website/src/app/globals.css)), reduced-motion snippet SSOT ([`website/src/a11y/cssMotionContract.ts`](../website/src/a11y/cssMotionContract.ts)), account assertive priority ([`website/src/lib/accountAssertiveMessage.ts`](../website/src/lib/accountAssertiveMessage.ts)).

### Engineer

- **Direct proof (runtime):** Vitest + Testing Library in `website/__tests__/` (live-region matrix, `SkipToMainContent`, reduced-motion file contract). Playwright in [`test/website-holistic/`](../test/website-holistic/) against a running production server: skip-to-main focus, focus-ring outline contract on `/`, and **`/verify`** run + contradiction/human-report visibility ([`test/website-holistic/demo-try-it.spec.ts`](../test/website-holistic/demo-try-it.spec.ts)).
- **Backstop proof:** Lighthouse CI via [`website/lighthouserc.cjs`](../website/lighthouserc.cjs) on **`http://127.0.0.1:3040/`**, `/pricing`, `/security` with fixed category floors (performance **0.72**, accessibility / best-practices / SEO **0.96**). LHCI scores are **not** treated as primary proof of focus rings or live-region wiring; they catch gross aggregate regressions.
- **Orchestrator:** [`scripts/website-holistic-gate.mjs`](../scripts/website-holistic-gate.mjs) — validates env, starts `next start` for the website workspace on port **3040**, probes readiness, runs Playwright then `lhci autorun`. Exit **2** = missing env, **3** = readiness or **5xx** on probed routes, **1** = Playwright or LHCI failure.

### Integrator

- No change to public HTTP APIs or OpenAPI from this bar. Copy for announcements lives in [`website/src/content/productCopy.ts`](../website/src/content/productCopy.ts) (`tryIt.a11ySuccessAnnouncement`, `account.*`, `signInA11y.*`).

### Operator

- **When:** `npm run verify:web-marketing-copy` from repo root (after `npm run validate-commercial` in CI so Postgres is migrated). The script appends **`node scripts/website-holistic-gate.mjs`** after website Vitest.
- **Env parity:** The gate requires the **same** keys as the `commercial` job env in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`DATABASE_URL`, `AUTH_SECRET` ≥32 chars, `CONTACT_SALES_EMAIL`, Stripe keys and three price ids). The gate injects `PORT=3040` and `NEXTAUTH_SECRET=$AUTH_SECRET`. It does **not** set `NEXT_PUBLIC_APP_URL` on the Next process (production `next.config` asserts that when set it matches `productionCanonicalOrigin`; Playwright/LHCI still target `http://127.0.0.1:3040` in their configs).
- **Playwright browser:** CI runs `npx playwright install chromium` before `verify:web-marketing-copy` on the commercial job.
- **LHCI routes:** `/` (discovery shell), `/pricing` (commercial + session chrome), `/security` (trust / long-form). `/auth/signin` is covered by Vitest only (not in LHCI collection).

## Commercial (pointers only)

- Plan marketing fields and numeric limits: [`config/commercial-plans.json`](../config/commercial-plans.json); parity checks: `npm run check:commercial-plans` (see [`docs/commercial.md`](commercial.md)).
- Billing, subscriptions, Checkout, Customer Portal, webhooks, account commercial APIs, usage reserve, and OpenAPI contracts: normative only in [`docs/commercial.md`](commercial.md).
