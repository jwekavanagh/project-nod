# Public distribution SSOT

Single place for **public identity**, **anchor sync**, **CI / Vitest public origin**, and **OpenAPI discoverability** (valid OpenAPI 3.0.3 with explicit pointers to GitHub, npm, the canonical site, `/integrate`, and the spec URL).

## Engineer

### Artifact ownership

| Path | Role | Hand edit? |
|------|------|------------|
| `config/public-product-anchors.json` | Authoritative: `identityOneLiner`, `productionCanonicalOrigin`, git/npm/bugs URLs, `keywords` | Yes |
| `schemas/openapi-commercial-v1.in.yaml` | OpenAPI source with sync tokens only (no hardcoded distribution URLs) | Yes |
| `schemas/openapi-commercial-v1.yaml` | Derived from sync | No |
| `website/public/openapi-commercial-v1.yaml` | Derived (gitignored); `servers[0].url` and self-URL use effective public origin | No |
| Root `package.json` | `description`, `repository`, `homepage`, `bugs`, `keywords` from sync | No (those fields) |
| `README.md` | Only the region between `<!-- public-product-anchors:start -->` and `<!-- public-product-anchors:end -->` | No inside markers |

### Maintainer sync (normative)

From **repository root** only:

- After editing anchors or hand-editable surfaces: **`npm run sync:public-product-anchors`**
- Validate only: **`npm run check:public-product-anchors`**

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
  - `info.x-workflow-verifier-distribution` with keys **`repository`**, **`npmPackage`**, **`openApi`**

API semantics remain in **`docs/commercial-ssot.md`**.

## Operator

### CI (`jobs.commercial.env`)

Exactly **eight** variables (names only; values match `.github/workflows/ci.yml`):

`DATABASE_URL`, `AUTH_SECRET`, `CONTACT_SALES_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_INDIVIDUAL`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_BUSINESS`

**`NEXT_PUBLIC_APP_URL`** and **`VERCEL_ENV`** are **not** set in YAML. `scripts/validate-commercial-funnel.mjs` sets them from `config/public-product-anchors.json` (`normalize(productionCanonicalOrigin)` and `VERCEL_ENV=production`) for `drizzle-kit migrate` and website Vitest.

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

### `distribution-graph.test.ts`

**`npm run validate-commercial`** from repo root is required to run `website/__tests__/distribution-graph.test.ts` (Postgres `DATABASE_URL`, injected public origin, full harness). Running bare `cd website && npx vitest` without that harness is **unsupported** for that file.
