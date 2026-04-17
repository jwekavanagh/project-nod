# Discovery guides (SSOT)

Single narrative for **indexable** `/guides/*` acquisition pages, the **indexable** `/guides` Learn hub (lists guides plus bundled proof examples), sitemap policy, and how this differs from **`/r/*` share links**.

## Audiences

| Audience | Use this doc for |
|----------|------------------|
| **Engineer** | Adding or removing an indexable guide: edit `indexableGuides` in `config/discovery-acquisition.json`, add `website/src/app/guides/<segment>/page.tsx`, use `IndexedGuideShell`, run validations. |
| **Integrator** | Same fixture (`langgraph-guide.v1.json`) powers every indexable guide embed; `VerificationReportView` shows ROW_ABSENT from the bundled demo. |
| **Operator** | GitHub templates below; redaction before committing any **new** public JSON; do not rely on `/r/` for SEO. |

## SSOT split (by artifact)

| Concern | Where it lives |
|---------|----------------|
| Which guides exist, `navLabel`, `problemAnchor`, **order** (semantic for `llms.txt`) | `config/discovery-acquisition.json` → `indexableGuides` |
| JSON Schema | `config/discovery-acquisition.schema.json` |
| Validation (unique paths, anchor ⊆ `demandMoments` for entries 2–5) | `scripts/discovery-acquisition.lib.cjs` → `validateDiscoveryAcquisition` |
| Page shell (embed + single `/integrate` CTA) | `website/src/components/guides/IndexedGuideShell.tsx` |
| Redaction string semantics (doc equivalence, **not** runtime) | `scripts/redaction-rules.cjs` + `test/redaction-rules.test.mjs` |

## Information architecture

- **Indexable** guide URLs are **only** those listed in `indexableGuides[].path`. Each page exports `metadata.robots: { index: true, follow: true }` and a **page-level** `alternates.canonical` equal to `{productionCanonicalOrigin}{path}`.
- **Hub** `/guides` (Learn): `metadata.robots: { index: true, follow: true }`; canonical `{productionCanonicalOrigin}/guides`. The hub lists all `indexableGuides` entries and, in **`#bundled-proof`**, all `indexableExamples` entries (`/examples/wf-complete`, `/examples/wf-missing`). Primary nav label **Learn** maps to this URL.
- **`sitemap.xml`** includes each `indexableGuides[].path`, each `indexableExamples[].path`, **and** `/guides` (position: immediately after `/integrate`, before `/support`—see [`website/src/app/sitemap.ts`](../website/src/app/sitemap.ts)).
- **`llms.txt`** `## Primary links` includes **Learn:** `{origin}/guides` (after First-run integration). It appends `## Indexable guides` with one `- {origin}{path}` bullet per guide **in JSON array order** (before indexable examples and the terminal demo block).

## Non-indexable routes under `/guides/*`

Routes may exist under `app/guides/` that are **not** in `indexableGuides`. They must export **noindex** robots and must **not** be linked from the hub until promoted into `indexableGuides`.

## `/r/*` vs guides

- **`GET /r/{id}`** is **noindex** and may contain sensitive tool parameters. Use it for **private** sharing (Slack, tickets), not organic discovery.
- **Indexed** explanation and acquisition live on **`/guides/*`**, the acquisition slug, `/guides` (hub), and `/integrate`.

## Redaction (`jq` + reference code)

Before committing **new** embed JSON derived from real runs, operators should redact strings. The **normative behavior** is implemented in `scripts/redaction-rules.cjs` (`applyRedactionWalk`); CI proves it in `test/redaction-rules.test.mjs`.

Equivalent `jq` (CLI-friendly):

```bash
jq 'walk(
  if type == "string" then
    if test("(?i)^Bearer[[:space:]]+[^[:space:]]+") then "[REDACTED_BEARER]"
    elif test("(?i)sk-[a-zA-Z0-9]{20,}") then "[REDACTED_SK]"
    elif test("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}") then "[REDACTED_EMAIL]"
    elif length > 240 then "[REDACTED_LONG_STRING_LEN_" + (length | tostring) + "]"
    else . end
  else . end
)' envelope.json > redacted.json
```

Output must still validate against `schemas/public-verification-report-v1.schema.json` before merge.

## GitHub templates (copy-paste)

### Pinned Discussion (title)

`AgentSkeptic — database truth vs traces`

### Pinned Discussion (body)

```markdown
When traces look green but Postgres or SQLite rows are wrong, see the acquisition page and Learn hub:

- https://agentskeptic.com/database-truth-vs-traces
- https://agentskeptic.com/guides

First-run on your DB: https://agentskeptic.com/integrate
```

### Release notes (short)

Link `database-truth-vs-traces`, `/guides`, and `/integrate`; point CLI users to the repo README discovery fold.
