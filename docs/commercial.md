# Commercial layer — single source of truth

<!-- epistemic-contract:consumer:commercial -->
**Epistemic framing (pointer only):** [`epistemic-contract.md`](epistemic-contract.md). Adoption and verdict semantics: [`adoption-epistemics.md`](adoption-epistemics.md).
<!-- /epistemic-contract:consumer:commercial -->

This document is the **narrative SSOT** for the thin commercial layer (website, billing, API keys, CLI preflight). It does **not** redefine CLI verification semantics—see [verification-product.md](verification-product.md) and [agentskeptic.md](agentskeptic.md).

**Related (integrator, not duplicated here):** [first-run-integration.md](first-run-integration.md) — run verification against your own SQL database; rendered on the site as **`/integrate`**.

<!-- buyer-surface-commercial-boundary:begin -->

## Commercial boundary

The **published npm CLI** path for licensed contract **`verify`** and **`quick`** with lock flags uses a valid API key and a successful **`POST /api/v1/usage/reserve`**. **Starter** includes a **finite free** monthly allowance for licensed **`verify`** (see [`config/commercial-plans.json`](../config/commercial-plans.json)); **`enforce`** and **`--expect-lock`** require a **paid** plan with an **active** Individual, Team, Business, or Enterprise subscription (Stripe **trialing** counts). The default **OSS** build runs contract **`verify`** / **`quick`** without a license server and can emit **`--output-lock`** fixtures. **Paid** plans add **metered overage** after the included amount (Stripe subscription has a **base** Price + **metered** overage Price; see `scripts/stripe-bootstrap.mjs`). Full matrix: *Free vs paid boundary* below.

In-process **`createDecisionGate`** in your application evaluates read-only SQL and **does not** call the reserve API; metering applies to the **CLI entry points** that perform license preflight.

## Evaluation path

Run the mechanical first-run path on the canonical site at **`/integrate`** (clone, build, bundled demo, then crossing on your prepared SQLite or Postgres). When you need Stripe-backed metering, API keys, and plan caps, use **`/pricing`** on the same site and keep this repository’s **commercial SSOT** (`docs/commercial.md`) as the normative contract for entitlements.

<!-- buyer-surface-commercial-boundary:end -->

**Operator funnel metrics (North Star):** [funnel-observability.md](funnel-observability.md) — acquisition and integrate impressions, anonymous CLI activation (`verify_started` / `verify_outcome` via `product_activation_*_beacon` on **telemetry** Postgres), and licensed CLI completion beacons on core (`funnel_event` / `verify_outcome_beacon`). Storage split: [telemetry-storage.md](telemetry-storage.md). Stage-separated rolling conversion metric ids live only in [growth-metrics.md](growth-metrics.md): `CrossSurface_ConversionRate_AcquisitionToIntegrate_Rolling7dUtc`, `CrossSurface_ConversionRate_IntegrateToVerifyOutcome_Rolling7dUtc`, `CrossSurface_ConversionRate_QualifiedIntegrateToVerifyOutcome_Rolling7dUtc` (integrate→outcome with **`workload_class` = `non_bundled`** numerator—see [Qualification proxy (operator)](funnel-observability.md#qualification-proxy-operator)), `CrossSurface_ConversionRate_QualifiedIntegrateToIntegratorScopedVerifyOutcome_Rolling7dUtc` (same denominator; numerator also requires **`workflow_lineage` = `integrator_scoped`** on schema v3 activation rows—see [growth-metrics.md](growth-metrics.md) §**CrossSurface_ConversionRate_QualifiedIntegrateToIntegratorScopedVerifyOutcome_Rolling7dUtc**), and the existing compressed `CrossSurface_ConversionRate_AcquisitionToVerifyOutcome_Rolling7dUtc`. **Interpretation (user vs telemetry capture)** is normative under [User outcome vs telemetry capture (operator)](funnel-observability.md#user-outcome-vs-telemetry-capture-operator). **CLI activation POST reachability** (403/400/204 behaviors and split-origin guidance) is normative only under **Activation reachability (operator)** in [funnel-observability.md](funnel-observability.md#activation-reachability-operator)—not duplicated here.

## Approved product scope (v1)

**Normative numbers and prices** are **only** in [`config/commercial-plans.json`](../config/commercial-plans.json) (`schemaVersion: 2`). Do not duplicate tier tables here—this file explains **behavior**.

**Implementation (v2):**

- **Included + overage:** Per-plan monthly **included** verification count and **per-verification overage** rate (micro‑USD in JSON) apply to **paid** self-serve tiers. **`POST /api/v1/usage/reserve`** allows usage past included when `allowOverage` is true; **Starter** has a **hard cap** (no overage). **Enterprise** is unlimited / contract.
- **Stripe:** Checkout creates two **line items** (licensed **base** + **metered** overage). **`user.stripe_price_id`** stores the **non‑metered** base Price id (`flatPriceIdFromSubscription` in code). Overage quantities are reported to Stripe on a schedule (see `POST /api/internal/usage/overage-reconcile`).

**Enterprise** is **sales-assisted only** (mailto + operator SQL). It is **outside** the self-serve non-negotiable outcome and **outside** the binary `solved` verdict for the commercial funnel.

### Numeric limits (SSOT)

**Source of truth:** [`config/commercial-plans.json`](../config/commercial-plans.json) — included amounts, list prices, annual prepay cents, overage microusd/verification, and Stripe env key *names* (not secrets).

<!-- commercial-plans-parity: included monthly (starter, individual, team, business) = 1000, 5000, 20000, 100000 — scripts/check-commercial-plans.mjs -->

### Free vs paid boundary (normative v1)

Single matrix for what the **default OSS artifact** vs **published commercial npm** vs **website Starter account** allow. “Paid” here means an **active** self-serve subscription on Individual, Team, or Business (or operator-granted Enterprise) **and** a successful **`POST /api/v1/usage/reserve`** where applicable—not merely having an API key on Starter.

| Capability | OSS build (`WF_BUILD_PROFILE=oss`) | Commercial npm + subscription + reserve | Starter account (no paid subscription) |
|------------|--------------------------------------|------------------------------------------|----------------------------------------|
| Contract **`verify`** / **`quick`** without API key | Yes | No (requires key + reserve + entitlement) | N/A (use OSS or subscribe) |
| **`--output-lock`** on batch / quick | Yes (generates lock fixture; no reserve) | Yes (reserve `intent=verify`) | N/A |
| **`--expect-lock`** on batch / quick | No (exit `ENFORCE_REQUIRES_COMMERCIAL_BUILD`) | Yes (reserve `intent=enforce` per lock orchestration) | N/A |
| **`agentskeptic enforce`** | No | Yes (reserve `intent=enforce`) | N/A |
| Licensed monthly quota consumption | No | Yes, per API key; included then overage on paid | Yes, up to Starter **included** cap per key (`includedMonthly` in JSON; no overage) |

**Why this shape:** OSS stays useful for adoption and local experimentation (including generating lock artifacts). **Subscription-backed reliance** for the published npm path—licensed verify, compare against an existing lock in CI, and **`enforce`**—is gated by the license server and Stripe-backed entitlement. Normative CLI split: **[`docs/commercial-enforce-gate-normative.md`](commercial-enforce-gate-normative.md)**; CI recipes: **[`docs/ci-enforcement.md`](ci-enforcement.md)**.

**Outcome Certificate vs billing:** The public **Outcome Certificate** JSON never contains Stripe, plan, or quota fields. Subscription and reserve gate **whether verification is allowed to run**; see [`outcome-certificate-normative.md`](outcome-certificate-normative.md) and [`outcome-certificate-integrator.md`](outcome-certificate-integrator.md).

### Programmatic verification vs licensed CLI

In-process **`createDecisionGate`** (library embed in your application) evaluates read-only SQL against buffered structured events and **does not** call **`POST /api/v1/usage/reserve`**. **Licensed** metering applies to the **published npm CLI** entry points that perform license preflight before contract **`verify`**, **`quick`** with lock flags, and **`enforce`**.

## Packaging and CLI build profiles

| Artifact              | `WF_BUILD_PROFILE` | Behavior |
|-----------------------|--------------------|----------|
| OSS / this repo CI    | `oss` (default)    | No license preflight; contract **`verify`** without API key; **`enforce` unavailable** — **[`docs/commercial-enforce-gate-normative.md`](commercial-enforce-gate-normative.md)** |
| Published npm tarball | `commercial`       | Requires `AGENTSKEPTIC_API_KEY` (legacy `WORKFLOW_VERIFIER_API_KEY` accepted) + successful preflight for contract batch, quick verify, and **`enforce`** |

Codegen: **`node scripts/write-commercial-build-flags.mjs`** writes **`src/generated/commercialBuildFlags.ts`** (gitignored) before `tsc`. **`npm run build`** passes **`--oss`** so the default artifact stays OSS even if **`WF_BUILD_PROFILE`** is set in the shell; **`npm run build:commercial`** invokes the script with **`--commercial`** and requires **`COMMERCIAL_LICENSE_API_BASE_URL`**.

After **`tsc`**, the embedded license API origin is **`LICENSE_API_BASE_URL`** in **`dist/generated/commercialBuildFlags.js`** (not necessarily duplicated inside **`dist/cli.js`**). The **`Commercial npm publish`** workflow asserts the dispatch input URL against that file.

Forks: build with `oss` to omit the gate.

## HTTP — `POST /api/v1/usage/reserve`

- **Auth:** `Authorization: Bearer <api_key>`
- **Body:** `{"run_id": string, "issued_at": ISO8601, "intent"?: "verify"|"enforce"}`; reject if `|now - issued_at| > 300` seconds.
- **200:** `{"allowed":true,"plan","limit","used","included_monthly","overage_count"}` (total `used` may exceed `limit` on paid overage)
- **401:** invalid/revoked key
- **403:** `QUOTA_EXCEEDED`, `ENFORCEMENT_REQUIRES_PAID_PLAN`, `SUBSCRIPTION_INACTIVE`, `BILLING_PRICE_UNMAPPED` (paid plans with a set `user.stripe_price_id` only), or other entitlement/deny bodies; may include `upgrade_url`
- **400:** bad request
- **503:** server error

**Emergency:** `RESERVE_EMERGENCY_ALLOW=1` — valid keys on **individual/team/business/enterprise** bypass the **inactive subscription** check for **`verify`** and **`enforce`**. **Starter `enforce` remains denied** (paid-only). **Starter `verify` is not subscription-gated** (free included quota). **`BILLING_PRICE_UNMAPPED` is never bypassed** for **paid** subscriptions when a price id is set. **Quota and idempotency unchanged** (still enforced).

**`BILLING_PRICE_UNMAPPED`:** returned for **paid** plan users when **`user.stripe_price_id`** is set and the deployment’s **base** `STRIPE_PRICE_*` env values do not recognize that Price id. Remediation: align **monthly, yearly, and overage** `STRIPE_*` envs with Stripe, redeploy, or contact the operator.

## HTTP — `GET /api/v1/commercial/plans`

- **Auth:** none
- **200:** `{"schemaVersion", "plans"}` with public fields only (no Stripe price env key names). Same shapes as the OpenAPI `CommercialPlansResponse` component.

## Subscription state, Stripe webhooks, and account API

**Normative detail for billing sync, post-checkout UX, and deletion semantics lives here** (do not duplicate in other docs—link to this section).

### Stripe → database

- Webhooks: **`checkout.session.completed`**, **`customer.subscription.updated`**, **`customer.subscription.deleted`**. Operator env: **`STRIPE_SECRET_KEY`**, **`STRIPE_WEBHOOK_SECRET`**, **`STRIPE_PRICE_*`** (monthly + yearly **base**), **`STRIPE_OVERAGE_*`** (metered), **`CRON_SECRET`** (internal overage report route).
- **`user.stripe_price_id`:** nullable; stores the **licensed (non‑metered) base** recurring Stripe **Price** id (see `flatPriceIdFromSubscription`). Used to compute **`priceMapping`** on the account API.
- **Tier (`user.plan`):** derived from that Price id via env-backed mapping in [`config/commercial-plans.json`](../config/commercial-plans.json) (`STRIPE_PRICE_*` monthly and yearly variants). The metered overage line item is **not** used for `user.plan`.
- **Unknown Price id:** `plan` is left unchanged; `stripe_price_id` still records the id; logs `stripe_price_unmapped`; account shows **`priceMapping: unmapped`** and entitlement copy includes an operator-contact suffix. **`POST /api/v1/usage/reserve`** returns **`403`** with **`BILLING_PRICE_UNMAPPED`** (no quota consumed) until mapping is fixed.

### Customer Billing Portal and Checkout customer reuse

**Why two surfaces:** **Stripe Checkout** (via **`POST /api/checkout`**) is the **first-purchase** path. **Stripe Customer Billing Portal** (via **`POST /api/account/billing-portal`**) is the **ongoing self-serve** path for payment methods, invoices, cancellation, and plan/price changes **as enabled in the Stripe Dashboard** for that Customer. They are separate guarantees: Checkout can succeed without Portal ever being opened; Portal requires a persisted **`user.stripe_customer_id`**.

**Checkout:** Session params are built in [`website/src/lib/stripeCheckoutSessionParams.ts`](../website/src/lib/stripeCheckoutSessionParams.ts). If **`stripe_customer_id`** is already on the user row, Checkout passes **`customer`** (and does **not** send **`customer_email`**); otherwise **`customer_email`** is used for the first Stripe Customer creation path.

**Billing Portal session — `POST /api/account/billing-portal`** (session cookie, same auth model as other account routes):

| Status | Body |
|--------|------|
| **200** | `{"url":"<string>"}` — redirect browser to `url` |
| **401** | `{"error":"Unauthorized"}` |
| **404** | `{"error":"STRIPE_CUSTOMER_MISSING","message":"…"}` — no **`stripe_customer_id`** yet (complete Checkout once) |
| **500** | `{"error":"Internal Server Error"}` — Stripe misconfiguration or API failure; server logs JSON line **`{"kind":"billing_portal_session_failed",...}`** |

**Return URL:** **`{NEXT_PUBLIC_APP_URL}/account`** (trailing slash stripped).

**Account UI:** **`Manage billing`** is rendered **only** when **`GET /api/account/commercial-state`** (and server-rendered initial state) include **`hasStripeCustomer: true`** (non-empty trimmed **`stripe_customer_id`**).

**`GET /api/account/commercial-state` (authenticated):** JSON includes existing plan and billing fields plus **`monthlyQuota`**: **`yearMonth`** (UTC `YYYY-MM`), **`keys[]`** with per–API-key **`used`** and **`limit`** (use `null` for unlimited enterprise included monthly), **`distinctReserveUtcDaysThisMonth`** (count of distinct UTC calendar dates with a **`reserve_allowed`** row this month — account activity gauge only), and **`worstUrgency`** (`ok` \| `notice` \| `warning` \| `at_cap`) from usage vs plan thresholds. Operator rolling retention KPIs live in [`docs/growth-metrics.md`](growth-metrics.md); do **not** label the month gauge as that retention KPI in UI copy.

**Operator — Stripe Dashboard:** Enable the **Customer billing portal**; link the same **Products/Prices** used for self-serve Checkout so customers can switch plans without leaving Stripe’s UI. Misconfiguration surfaces as **500** on **`POST /api/account/billing-portal`** until fixed.

### `customer.subscription.deleted`

Single row semantics (match subscription + customer when possible; else fall back to customer id):

- **`subscription_status`** → `inactive`
- **`plan`** → `starter`
- **`stripe_subscription_id`** and **`stripe_price_id`** → `null`
- **`stripe_customer_id`** unchanged (reuse for a future checkout)

### HTTP — `GET /api/account/commercial-state` (session cookie)

- **Auth:** signed-in website user (NextAuth session).
- **Query:** optional **`expectedPlan`** = `individual` | `team` | `business` only; any other value → **400**.
- **200 body (always):** `plan`, `subscriptionStatus`, `priceMapping`, `entitlementSummary`, `checkoutActivationReady`, **`hasStripeCustomer`**.
- **`checkoutActivationReady`:** `true` only when the query includes a valid **`expectedPlan`** and the user row satisfies **`plan === expectedPlan`**, **`subscriptionStatus === active`**, **`priceMapping === mapped`**, and licensed **`verify`** would proceed per [`website/src/lib/commercialEntitlement.ts`](../website/src/lib/commercialEntitlement.ts) (no emergency flag). Used by **`/account`** after Checkout success polling. **Trialing** in Stripe maps to **`active`** in the DB ([`website/src/lib/stripeSubscriptionStatus.ts`](../website/src/lib/stripeSubscriptionStatus.ts)).

**OpenAPI:** this route is **not** part of [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml).

### Operator verification

From the repo root, **`npm run validate-commercial`** requires **`DATABASE_URL`** and **`TELEMETRY_DATABASE_URL`**, runs **`website/scripts/db-migrate.mjs`** and **`website/scripts/db-migrate-telemetry.mjs`**, then full website Vitest (including funnel DB tests), then **`scripts/pack-smoke-commercial.mjs`** and **`npm run build`** to restore OSS **`dist/`**.

## Machine contracts (OpenAPI)

- **Normative file (repo):** [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml)
- **Deployed URL (static):** **`/openapi-commercial-v1.yaml`** on the app origin. The file is generated into **`website/public/`** during **`website` `prebuild`** by **`npm run sync:public-product-anchors`** (which runs **`emit-primary-marketing`**) from the repo root, then served as a static asset. The committed copy under `schemas/` is the canonical spec for review; the public copy may use the effective deployment origin for `servers` and the self-URL.

### Public anchors and OpenAPI source

The editable OpenAPI “header” and distribution tokens live in [`schemas/openapi-commercial-v1.in.yaml`](../schemas/openapi-commercial-v1.in.yaml). [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml) is **generated** — do not hand-edit. Rationale (single source for URLs, valid OAS layout, no placeholder hosts): **[`docs/public-distribution.md`](public-distribution.md)**.

## `/integrate` and integrator documentation

- **Operator signal (integrate → qualified `verify_started`, rolling 7d UTC):** see metric id **`CrossSurface_ConversionRate_QualifiedIntegrateToVerifyStarted_Rolling7dUtc`** in [`growth-metrics.md`](growth-metrics.md)—not proof of **Decision-ready ProductionComplete** (artifact bar in [`adoption-epistemics.md`](adoption-epistemics.md)).
- **SSOT prose and commands** remain [`docs/first-run-integration.md`](first-run-integration.md) and [`docs/partner-quickstart-commands.md`](partner-quickstart-commands.md).
- **`/integrate` route:** [`website/src/app/integrate/page.tsx`](../website/src/app/integrate/page.tsx) renders **pack-led** copy from [`config/marketing.json`](../config/marketing.json) (`integratePage`: one command block, requirements, proof line, GitHub deep links) plus [`website/src/content/siteMetadata.ts`](../website/src/content/siteMetadata.ts) for the `h1` / description. It does **not** import **`integratorDocsEmbedded`** at build or runtime.
- **Build-embedded strings:** **`website/src/generated/integratorDocsEmbedded.ts`** is still produced by **`node scripts/sync-integrator-docs-embedded.mjs`** during **`website` `prebuild`** so CI parity tests ([`website/__tests__/integratorDocsEmbedded.parity.test.ts`](../website/__tests__/integratorDocsEmbedded.parity.test.ts), [`website/__tests__/integrate-embedded.no-filesystem.test.ts`](../website/__tests__/integrate-embedded.no-filesystem.test.ts)) can assert the generated blobs track `docs/` without reading the monorepo `docs/` tree from the deployed serverless bundle for **`/integrate`**.

**Concurrency:** Monthly counter row must be locked with **`SELECT … FOR UPDATE`** in the same transaction as idempotent `(api_key_id, run_id)` insert.

## CLI environment

| Variable                         | Purpose |
|----------------------------------|---------|
| `AGENTSKEPTIC_API_KEY`           | Plaintext API key (commercial build); legacy `WORKFLOW_VERIFIER_API_KEY` still read |
| `AGENTSKEPTIC_RUN_ID`            | Optional idempotency key (default: random UUID); legacy `WORKFLOW_VERIFIER_RUN_ID` still read |

Retries on 429/502/503/504: **250ms, 750ms, 2250ms** (3 attempts), then exit **3** `LICENSE_USAGE_UNAVAILABLE`.

Operational codes include: `LICENSE_KEY_MISSING`, `LICENSE_DENIED`, `LICENSE_USAGE_UNAVAILABLE`, `ENFORCEMENT_REQUIRES_PAID_PLAN`, `ENFORCE_REQUIRES_COMMERCIAL_BUILD` (see `src/cliOperationalCodes.ts`). The license preflight may still map a legacy `VERIFICATION_REQUIRES_SUBSCRIPTION` HTTP code for older deployments.

## Auth email (production vs E2E)

- **Production:** **Resend** SDK only (`resend` package).
- **E2E only:** When `E2E_COMMERCIAL_FUNNEL=1`, magic link email is sent via **Nodemailer SMTP** to **Mailpit** at `smtp://127.0.0.1:1025`. **Never** set `E2E_COMMERCIAL_FUNNEL` in production deploys.
- **Rate limits:** Magic link send throttling (caps, reservation algorithm, deny logs) is normative in **[website-magic-link-rate-limit.md](website-magic-link-rate-limit.md)** — do not duplicate numeric caps here.

## Legal effective date

[`config/legal-metadata.json`](../config/legal-metadata.json) is the **sole** source for `effectiveDate` and `termsVersion` (no env overrides).

## Database migrations

From `website/` with `DATABASE_URL` and `TELEMETRY_DATABASE_URL` set:

```bash
npm run db:migrate
npm run db:migrate:telemetry
```

Core migrations live in [`website/drizzle/`](../website/drizzle/) (e.g. `0000_initial.sql`). Telemetry migrations live in [`website/drizzle-telemetry/`](../website/drizzle-telemetry/).

## Validation matrix (Layer 2)

Services (see [`docker-compose.commercial-e2e.yml`](../docker-compose.commercial-e2e.yml)):

- **Postgres 16** — app `DATABASE_URL` plus telemetry `TELEMETRY_DATABASE_URL`. For **Supabase** on **Vercel**, use **`sslmode=require`** (or rely on helpers in [`website/src/db/ensureSslModeRequire.ts`](../website/src/db/ensureSslModeRequire.ts)): the **`postgres.js`** client uses **`ensureSslModeRequire()`**; **`npm run db:migrate`** (drizzle-kit under the hood) uses **`node-pg`**, which currently treats bare `sslmode=require` like **`verify-full`** and can throw **`SELF_SIGNED_CERT_IN_CHAIN`**—so **`drizzle.config.ts`** uses **`ensureDatabaseUrlForNodePgDriver()`**, which adds **`uselibpqcompat=true`** as required by the `pg` / `pg-connection-string` migration warning.
- **Mailpit** — SMTP `127.0.0.1:1025`, UI/API `8025`

**Stripe CLI:** `stripe listen --forward-to <BASE_URL>/api/webhooks/stripe` — use the printed **`whsec_…`** as `STRIPE_WEBHOOK_SECRET` for that process.

**Mailpit messages API:** `GET http://127.0.0.1:8025/api/v1/messages` (see Mailpit docs for stable JSON shape).

### Staging checklist (self-serve billing — binary “solved”)

Run once per environment with **test-mode** Stripe keys before promoting:

1. **`stripe listen`** forwarding to **`/api/webhooks/stripe`**; **`STRIPE_WEBHOOK_SECRET`** matches the listener.
2. Sign in, **`POST /api/checkout`** for a self-serve plan → complete Checkout → confirm webhook updates **`user`** (`plan`, **`subscription_status`**, **`stripe_customer_id`**, **`stripe_subscription_id`**, **`stripe_price_id`**).
3. **`/account`**: **`hasStripeCustomer`** true; **Manage billing** opens Portal; return lands on **`/account`**.
4. Second Checkout while logged in: Stripe Dashboard shows **one** Customer for that test user (reuse via **`customer`** on Checkout).
5. **`POST /api/v1/usage/reserve`** with API key returns **200** when subscription active and price mapped.
6. Negative: set **`stripe_price_id`** to an unknown Price id in DB (test only) → reserve returns **`403`** **`BILLING_PRICE_UNMAPPED`**; restore row.

**Verdict:** **Solved** only if steps 1–6 pass; otherwise **not solved**.

## Enterprise operator runbook

```sql
-- Example: grant enterprise (exact table/column names follow Drizzle schema in website)
UPDATE "user" SET plan = 'enterprise', subscription_status = 'active' WHERE email = 'customer@example.com';
```

## API key storage

API keys are verified with **Node `crypto.scrypt`** (parameters fixed in website code and reviewed with security in mind). Store **salt + hash** only; show plaintext **once** at creation.

## Roadmap (v1.1+)

- (Reserved for future product work.) Metered overage after included quota is **live** in [`config/commercial-plans.json`](../config/commercial-plans.json) and Stripe; buyer-visible rates are built from that file in [`website/src/lib/commercialNarrative.ts`](../website/src/lib/commercialNarrative.ts).
