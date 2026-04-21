# Discovery surfaces

Single place for **which URLs are indexable**, which stay **private**, and how they relate to **`llms.txt`**, the **sitemap**, and **markdown-backed** discovery content.

## Scope

This document covers **human and agent discovery** for the AgentSkeptic website. Wire formats for posting private reports remain in [`shareable-verification-reports.md`](shareable-verification-reports.md).

**Authoring:** Routable discovery pages live as markdown under `website/content/surfaces/{guides,examples,compare}/` with Zod-validated frontmatter (`website/src/lib/surfaceMarkdown.ts`). URLs are fixed to `/guides/<slug>`, `/examples/<slug>`, and `/compare/<slug>` via `website/src/app/guides/[slug]/page.tsx`, `examples/[slug]/page.tsx`, and `compare/[slug]/page.tsx`. Acquisition copy for `/` and `/database-truth-vs-traces` stays in [`config/discovery-acquisition.json`](../config/discovery-acquisition.json). The buyer authority guides under `/guides/buyer-*` are **generated** from fenced excerpts in normative docs by [`scripts/sync-buyer-authority-surfaces.mjs`](../scripts/sync-buyer-authority-surfaces.mjs) (wired in `website/package.json` `prebuild` / `test:vitest`).

**Requirement 3 (first-run):** The only `guideJob: implementation` surface is [`website/content/surfaces/guides/first-run-verification.md`](../website/content/surfaces/guides/first-run-verification.md) at `/guides/first-run-verification`; CI enforces literals and `primaryCta: integrate` in `website/__tests__/surface-job.contract.test.ts`.

**Merge gate:** `website/__tests__/metadata-matrix.test.ts` requires pairwise-unique `title` and `description` plus per-route `alternates.canonical` for the homepage, commercial/legal shells, Learn and Compare hubs, **`/problems`**, and every globbed surface route. **`/claim`** is intentionally excluded from that matrix because it is **`noindex, nofollow`**. The root [`website/src/app/layout.tsx`](../website/src/app/layout.tsx) must not set a global `alternates.canonical` or `openGraph.url`.

**Migration proof:** [`website/__tests__/fixtures/guide-migration-goldens.json`](../website/__tests__/fixtures/guide-migration-goldens.json) and [`guide-migration-length-floors.json`](../website/__tests__/fixtures/guide-migration-length-floors.json) back `website/__tests__/guide-migration.parity.test.ts`.

**Manual:** When adding routes, extend `llms.txt` via `npm run sync:public-product-anchors` (or the scripts it chains) so Primary links stay aligned.

## Indexable routes

- **Acquisition slug** from `config/discovery-acquisition.json` → `slug` (currently `/database-truth-vs-traces`).
- **`/problems`** — lists `problemIndex` from `config/discovery-acquisition.json` in publication order (primary guide plus related paths); indexable; in `sitemap.xml`; primary nav **Problems** links here after **Learn** (`/guides`).
- **`/guides`** — Learn hub: lists markdown **guides** (`surfaceKind: guide`), **failure scenarios** (`surfaceKind: scenario`), and bundled **examples**; indexable; in `sitemap.xml` after `/integrate`.
- **`/guides/*`** — one file per slug under `content/surfaces/guides/`; included in `sitemap.xml` and under `## Indexable guides` in `llms.txt` (sorted by `route`).
- **`/examples/*`** — under `content/surfaces/examples/`; same indexability; **`GET /examples`** (no slug) **308** to **`/guides`** (see [`website/next.config.ts`](../website/next.config.ts)).
- **`/compare`** hub and **`/compare/*`** — evaluator comparisons under `content/surfaces/compare/`; indexable; listed after examples in `llms.txt` (`## Indexable comparisons`).

## Private routes

- **`GET /r/{id}`** — persisted user reports when enabled; **`noindex, nofollow`**; **must not** appear in `sitemap.xml`. See [`shareable-verification-reports.md`](shareable-verification-reports.md).

## Authentication and claim (not discovery index targets)

- **`/auth/signin`** — sign-in entrypoint; **not** listed in `sitemap.xml` (authentication surface only).
- **`/claim`** — OSS claim handoff; **`robots: { index: false, follow: false }`**; **not** part of the metadata uniqueness merge gate for indexable marketing routes.

## Sync commands

From repository root after editing `config/discovery-acquisition.json` or anchors:

- `npm run sync:public-product-anchors`
- `npm run check:discovery-acquisition`

## Embed redaction

Before committing new JSON derived from real runs, follow redaction rules in `scripts/redaction-rules.cjs` and `test/redaction-rules.test.mjs` (see [`shareable-verification-reports.md`](shareable-verification-reports.md) for posting semantics).
