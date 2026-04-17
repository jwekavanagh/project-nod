# Discovery surfaces

Single place for **which URLs are indexable**, which stay **private**, and how they relate to **`llms.txt`** and the **sitemap**.

## Scope

This document covers **human and agent discovery** for the AgentSkeptic website. Wire formats for posting private reports remain in [`shareable-verification-reports.md`](shareable-verification-reports.md). Authoring steps for `/guides/*` pages remain in [`discovery-guides.md`](discovery-guides.md).

## Indexable routes

- **Acquisition slug** from `config/discovery-acquisition.json` → `slug` (currently `/database-truth-vs-traces`).
- **`/guides`** — Learn hub: **indexable**; lists `indexableGuides` and bundled proof links (`indexableExamples`); appears in `sitemap.xml` after `/integrate`; `## Primary links` in `llms.txt` includes **Learn:** canonical URL.
- **`/guides/*`** — only paths listed in `indexableGuides[]`; each has `metadata.robots` indexable and appears in `sitemap.xml` and under `## Indexable guides` in `llms.txt`.
- **`/examples/wf-complete`** and **`/examples/wf-missing`** — only paths listed in `indexableExamples[]`; same indexability rules as guides. They render **committed** public-report JSON, not database-backed rows. The former top-level hub path **`GET /examples`** (without a leaf segment) **308** redirects to **`/guides`** (see [`website/next.config.ts`](../website/next.config.ts)); fragments like `/guides#bundled-proof` are for same-origin authored links only.

## Private routes

- **`GET /r/{id}`** — persisted user reports when enabled; **`noindex, nofollow`**; **must not** appear in `sitemap.xml`. See [`shareable-verification-reports.md`](shareable-verification-reports.md).

## Sync commands

From repository root after editing `config/discovery-acquisition.json` or anchors:

- `npm run sync:public-product-anchors`
- `npm run check:discovery-acquisition`

## Embed redaction

Before committing new JSON derived from real runs, follow the redaction guidance in [`discovery-guides.md`](discovery-guides.md) (`## Redaction`).
