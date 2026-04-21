# Public distribution SSOT

Single place for **public identity**, **anchor sync**, **CI / Vitest public origin**, and **OpenAPI discoverability** (valid OpenAPI 3.0.3 with explicit pointers to GitHub, npm, the canonical site, `/integrate`, and the spec URL).

**Cross-repo consumer proof** (a separate GitHub repository, PAT, and Actions workflow that re-runs `npx agentskeptic@latest`) is **not** part of this repository's product contract. In-repo distribution assurance is **`npm run validate-commercial`** (including pack smoke and the website tests referenced below).

## Engineer

### Ownership: discovery JSON vs productCopy.ts

| Source | Role |
|--------|------|
| **`config/discovery-acquisition.json`** | Acquisition fold, visitor answer, hero titles, CTA label, and machine-readable appendix inputs consumed by sync and the Next.js app. |
| **`website/src/content/marketingContracts.ts`** | Contract-tested marketing copy: `/pricing` feature comparison grid + commercial terms bullets; homepage evaluator/adoption block; metering clarifier (sign-in + homepage commercial strip); security quick-fact line consumed via `productCopy` composition. |
| **`website/src/content/productCopy.ts`** | Site-only strings (account, integrate shell, a11y, pricing hero recap, etc.) **excluding** the pricing grid and commercial terms bullets (see **`marketingContracts.ts`**). |
| **`llms.txt`** | Committed root agent surface (byte-synced with the site after **`npm run sync:public-product-anchors`**). |

### Artifact ownership

| Path | Role | Hand edit? |
|------|------|------------|
| `config/public-product-anchors.json` | Authoritative: `identityOneLiner`, `productionCanonicalOrigin`, git/npm/bugs URLs, `keywords` | Yes |
| `src/publicDistribution.generated.ts` | CLI stderr **`formatDistributionFooter()`** (multi-line funnel + SSOT; from sync) | No |
| `src/distributionFooter.ts` | Re-export footer for CLI | Yes (thin) |
| `AGENTS.md` | Agent pointer to SSOT | No (sync-written) |
| `test/registry-metadata-parity.test.mjs` | Committed **`package.json` `description`** equals **`pageMetadata.description`** and not **`identityOneLiner`** | No |
| `config/discovery-acquisition.json` | Acquisition copy: `readmeTitle`, `homepageHero` (why/what/when; on `/database-truth-vs-traces` acquisition narrative and README fold—not in homepage `<main>`), homepage `<main>` hero uses `heroTitle`, `homepageDecisionFraming`, then `productCopy.homeHeroShortTagline` ( **`heroSubtitle`** stays on the acquisition page and README fold—not duplicated on `/` `<main>`), `problemIndex`, `cliFollowupLines`, visitor problem answer, **`shareableTerminalDemo`** (`title` + `transcript` for README fold fenced block, `/database-truth-vs-traces` `<pre>`, and `llms.txt` pasteable section—verbatim bundled demo contrast; homepage `/` shows only the **failure** slice via `shareableTerminalFailureExcerpt()` so it stays aligned without duplicating strings), **`pageMetadata.description`** (npm `description`, site-wide HTML meta, Open Graph/Twitter, `SoftwareApplication` JSON-LD `description`), homepage CTA label, `llms` appendix arrays, README fold template; consumed by sync and the website. Indexable guide/example URLs in `llms.txt` and the discovery payload appendix are derived from `website/content/surfaces/**/*.md` (see [`docs/discovery-surfaces.md`](discovery-surfaces.md)). | Yes |
| `config/discovery-acquisition.schema.json` | JSON Schema (draft-07): product-law patterns on `visitorProblemAnswer` and on **`pageMetadata.description`** (length + patterns), required fields | Yes |
| `scripts/discovery-acquisition.lib.cjs` | Validate discovery JSON, build README fold body (including appended acquisition markdown link); `llms` appendix sections consumed via [`discovery-payload.lib.cjs`](../scripts/discovery-payload.lib.cjs) | No (logic) |
| `scripts/discovery-payload.lib.cjs` | Single `DiscoveryPayload` v1 builder + `llms.txt` / CI Markdown renders + PR upsert selector | No (logic) |
| `scripts/write-discovery-payload.mjs` | Writes `dist/discovery-payload-v1.json` during build | No |
| `scripts/render-discovery-ci.mjs` | Consumer CI CLI: `summary` / `pr_body` from frozen payload | No |
| `dist/discovery-payload-v1.json` | Frozen payload shipped in npm tarball (gitignored until build) | No |
| `llms.txt` (repo root) | Committed agent surface; byte-synced with `website/public/llms.txt` after sync | No |
| `docs/ambient-ci-distribution.md` | Ambient GitHub Actions contract (sizes, upsert, permissions) | Yes |
| `scripts/validate-discovery-acquisition.mjs` | CLI: run validation only (`npm run check:discovery-acquisition`) | No |
| `schemas/openapi-commercial-v1.in.yaml` | OpenAPI source with sync tokens only (no hardcoded distribution URLs); includes **`POST /api/public/verification-reports`** (`createPublicVerificationReport`) | Yes |
| `schemas/openapi-commercial-v1.yaml` | Derived from sync | No |
| `schemas/public-verification-report-v1.schema.json` | Public share POST envelope (`workflow` \| `quick`) | Yes |
| `docs/shareable-verification-reports.md` | SSOT for `/r/{id}`, POST body cap (**393216** bytes), **`PUBLIC_VERIFICATION_REPORTS_ENABLED`**, CLI **`--share-report-origin`** | Yes |
| `docs/discovery-surfaces.md` | SSOT for indexable discovery URLs, markdown surfaces under `website/content/surfaces/`, sitemap/`llms.txt` policy, metadata merge gate, migration goldens | Yes |
| `docs/discovery-surfaces.md` | Indexable vs private discovery IA: `/guides/*`, `/examples/*`, `/r/*`, sync commands | Yes |
| `website/public/openapi-commercial-v1.yaml` | Derived (gitignored); `servers[0].url` and self-URL use effective public origin | No |
| Root `package.json` | **`description`** from **`config/discovery-acquisition.json` → `pageMetadata.description`**; **`repository`**, **`bugs`**, **`keywords`** from [`config/public-product-anchors.json`](../config/public-product-anchors.json) via sync; **`homepage`** from sync as **`normalize(productionCanonicalOrigin)` + `discovery.slug`** (canonical acquisition URL on the site, same path as the SSOT acquisition page) | No (those fields) |
| `README.md` | Regions between `<!-- discovery-readme-title:start/end -->`, `<!-- discovery-acquisition-fold:start/end -->`, and `<!-- public-product-anchors:start/end -->` | No inside markers (all are sync-written) |
| `website/src/content/marketingContracts.ts` | Hand-authored marketing strings under Vitest contract: `/pricing` comparison grid + commercial terms bullets, homepage evaluator block, metering clarifier, security quick-fact fragment | Yes |

### Maintainer sync (normative)

From **repository root** only:

- After editing anchors, **`config/discovery-acquisition.json`**, or other hand-editable surfaces: **`npm run sync:public-product-anchors`**
- Validate only: **`npm run check:public-product-anchors`** (runs OpenAPI token check + discovery schema validation).
- Discovery-only validate: **`npm run check:discovery-acquisition`**
- Registry metadata parity (committed **`package.json` `description`** vs **`pageMetadata.description`**): **`node --test test/registry-metadata-parity.test.mjs`** (included in **`npm run test:node:sqlite`** and **`npm run validate-commercial`** after migrate).

Do **not** document `node scripts/public-product-anchors.cjs` as the primary workflow; the npm scripts above are the prescribed entrypoints.

The website **`prebuild`** must be exactly:

`npm --prefix .. run sync:public-product-anchors && node ../scripts/sync-integrator-docs-embedded.mjs`

**`--prefix` is a global npm option** and must appear **immediately after `npm`**, before `run` — not after the script name.

### Website tests that touch OpenAPI / `npm pack`

`website/package.json` `devDependencies` for these tests are fixed to **`tar@7.5.13`** and **`yaml@2.8.3`** (exact versions). Use `import tar from 'tar'` / `await tar.x(…)` and `import { parse } from 'yaml'` — see `website/__tests__/distribution-graph.test.ts` and `openapi-commercial.contract.test.ts`.

## Integrator

- **`productionCanonicalOrigin`** in `config/public-product-anchors.json` is the canonical browser origin (normalized to `URL.origin`).
- **Committed** repo OpenAPI (`schemas/openapi-commercial-v1.yaml`) uses that origin for `servers` and distribution URLs where specified by the sync algorithm.
- **Served** copy under `website/public/` uses `NEXT_PUBLIC_APP_URL` when set (non-whitespace) for `servers` and the self OpenAPI URL; otherwise it falls back to `productionCanonicalOrigin`.
- Discoverability in the spec:
  - `info.contact.url` — canonical site origin
  - Root **`externalDocs`** (not under `info`) — first-run integration guide at `{canonical}/integrate` with **`description: "First-run integration guide"`**
  - `info.x-agentskeptic-distribution` with keys **`repository`**, **`npmPackage`**, **`openApi`**
- **Public share surfaces (literals):** **`POST {canonical}/api/public/verification-reports`**, **`GET {canonical}/r/{uuid}`** (HTML report; **`X-Robots-Tag: noindex, nofollow`**), indexable guide **`GET {canonical}/guides/verify-langgraph-workflows`**. Normative: [`shareable-verification-reports.md`](shareable-verification-reports.md).
- **Ambient CI (GitHub):** job summary + optional PR upsert for commercial verify — single contract in [`ambient-ci-distribution.md`](ambient-ci-distribution.md); payload + renders live in [`scripts/discovery-payload.lib.cjs`](../scripts/discovery-payload.lib.cjs).

API semantics remain in **`docs/commercial-ssot.md`**.

## Operator

### CI (`jobs.commercial.env`)

Exactly **eight** variables (names only; values match `.github/workflows/ci.yml`):

`DATABASE_URL`, `AUTH_SECRET`, `CONTACT_SALES_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_INDIVIDUAL`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_BUSINESS`

**`NEXT_PUBLIC_APP_URL`** and **`VERCEL_ENV`** are **not** set in YAML. `scripts/validate-commercial-funnel.mjs` sets them from `config/public-product-anchors.json` (`normalize(productionCanonicalOrigin)` and `VERCEL_ENV=production`) for Drizzle migrate steps and website Vitest.

Production deploys (e.g. Vercel) must set **`NEXT_PUBLIC_APP_URL`** to the same origin as **`productionCanonicalOrigin`** in JSON.

### Origin parity (Next config)

Loaded from `website/next.config.ts` via `assertNextPublicOriginParity()`:

```js
const skip =
  process.env.NODE_ENV !== "production" ||
  process.env.VERCEL_ENV === "preview";
if (!skip && normalize(process.env.NEXT_PUBLIC_APP_URL) !== normalize(canonicalFromJson))
  throw new Error("NEXT_PUBLIC_APP_URL must equal productionCanonicalOrigin");
```

### `distribution-graph.test.ts` and visitor outcome

**`npm run validate-commercial`** from repo root runs, in order after core + telemetry Drizzle migrate: **`node --test test/visitor-problem-outcome.test.mjs`** (README discovery fold strict equality + schema validation), then **`node --test test/registry-metadata-parity.test.mjs`** (committed **`package.json` `description`** matches **`pageMetadata.description`** and not **`identityOneLiner`**), then **`npx vitest run`** in `website/` (includes `website/__tests__/distribution-graph.test.ts`), then **`scripts/check-web-demo-prereqs.mjs`**, then **`scripts/pack-smoke-commercial.mjs`**, then **`npm run build`** (restore OSS **`dist/`**). Requires Postgres **`DATABASE_URL`** and **`TELEMETRY_DATABASE_URL`**, injected public origin, and full harness. Running bare `cd website && npx vitest` without that harness is **unsupported** for `distribution-graph.test.ts`.
