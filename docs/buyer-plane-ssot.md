# Buyer plane SSOT

Normative **write path** and **ownership** for buyer-plane work: acquisition metadata, problem index, fence-synced buyer guides, comparison discoverability, and rendered HTML tests.

## Metadata ownership

| Surface | Owner |
|---------|--------|
| Homepage + layout default SERP (`title.default`, default `description`, Open Graph / Twitter defaults, root `SoftwareApplication` description) | [`config/discovery-acquisition.json`](discovery-acquisition.json) via [`website/src/lib/discoveryAcquisition.ts`](../website/src/lib/discoveryAcquisition.ts) |
| Homepage route metadata (`/`) | Same fields, set in [`website/src/app/page.tsx`](../website/src/app/page.tsx) from discovery (not `siteMetadata` globals) |
| `/integrate`, `/security`, `/support`, `/claim` route-only metadata | [`website/src/content/siteMetadata.ts`](../website/src/content/siteMetadata.ts) — **must not** include top-level `title`, `description`, or `openGraph` that duplicate discovery for the whole site |

Root [`website/src/app/layout.tsx`](../website/src/app/layout.tsx) must **not** set global `alternates` or `openGraph.url` (merge gate).

## `problemIndex`

Single ordered array in `discovery-acquisition.json`. Each item: `moment` (display line), `primaryRoute` (must match `/guides|/examples|/compare` slug path), optional `relatedRoutes` (may include `/integrate`, `/pricing`, `/database-truth-vs-traces`, etc.).

Drives [`/problems`](../website/src/app/problems/page.tsx) row order and the `llms.txt` “When this hurts” appendix (via sync).

## Doc fences → generated guides

| Fence markers in `docs/` | Generated route | File |
|----------------------------|-----------------|------|
| `buyer-surface-commercial-boundary` | `/guides/buyer-commercial-boundary` | `website/content/surfaces/guides/buyer-commercial-boundary.md` |
| `buyer-surface-ci-enforcement-metering` | `/guides/buyer-ci-enforcement-metering` | `website/content/surfaces/guides/buyer-ci-enforcement-metering.md` |
| `buyer-surface-trust-production-implications` | `/guides/buyer-trust-production-implications` | `website/content/surfaces/guides/buyer-trust-production-implications.md` |

Sync: [`scripts/sync-buyer-authority-surfaces.mjs`](../scripts/sync-buyer-authority-surfaces.mjs) (repo root). Wired in [`website/package.json`](../website/package.json) `prebuild` after epistemic contract sync.

Fence bodies must include the exact `##` headings required by [`website/__tests__/buyer-authority-surfaces.contract.test.ts`](../website/__tests__/buyer-authority-surfaces.contract.test.ts) once that test exists.

## Req 4 — `/compare` on key entry pages

User-visible `href="/compare"` must appear in served HTML for:

- `/` — `commercialSurface` commercial-links; `howItWorks` muted line
- `/guides` — muted line after supporting lede
- `/problems` — intro under H1
- `/pricing` — after hero block (compare lead); after positioning (link to buyer-commercial-boundary)
- `/security` — five-item internal link list includes `/compare`

## Rendered link-graph tests

Use [`website/__tests__/helpers/siteTestServer.ts`](../website/__tests__/helpers/siteTestServer.ts) (`ensureMarketingSiteRunning`, `getSiteHtml`) like [`website/__tests__/distribution-graph.test.ts`](../website/__tests__/distribution-graph.test.ts): `DATABASE_URL`, `TELEMETRY_DATABASE_URL`, `next build` + `next start` on `127.0.0.1:34100`, long timeout, teardown.

Do **not** maintain a hand-frozen adjacency graph; derive links from fetched HTML (JSDOM).

## Indexability

- `/claim`: `noindex`
- Sitemap: no `/auth/signin`
- [`docs/discovery-surfaces.md`](discovery-surfaces.md) lists indexable routes including `/problems` and buyer guides
