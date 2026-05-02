# Shareable verification reports (normative)

Single source of truth for **public persisted reports**, the **`POST /api/public/verification-reports`** API, **`GET /r/{id}`** HTML, and the **`--share-report-origin`** CLI flag.

## Audiences

- **Engineer:** wire formats, response codes, CLI ordering, exit codes.
- **Integrator:** what gets stored, privacy expectations, LangGraph-shaped ingest (see also [`docs/first-run-integration.md`](first-run-integration.md)).
- **Operator:** environment flags, retention, disabling the surface, manual deletion.

## Trust boundary and privacy

- **POST (new writes):** body must match **`schemas/public-verification-report-v3.schema.json`** (`schemaVersion` **3** + **`certificate`** = **Outcome Certificate v2** including **`evidenceCompleteness`**). **There is no redaction**: tool parameters and human-readable lines may contain secrets.
- **GET (legacy rows):** older rows may store **`public-verification-report-v1`** payloads (`kind: workflow` \| `quick`) or **`public-verification-report-v2`**. **`VerificationReportView`** renders them read-only; those paths are **frozen** (security fixes only; owner: website maintainers).
- Reports are **immutable** after insert (no update API).

## Indexable marketing vs `/r/*`

- **`GET /r/{id}`** remains **`noindex`** (see HTML + `X-Robots-Tag` in this doc). It is for **private** artifact sharing, not organic discovery.
- **Indexable** problem-oriented pages live under **`/guides/*`** as markdown surfaces (see [`docs/discovery-surfaces.md`](discovery-surfaces.md)). Acquisition JSON remains the SSOT for `/database-truth-vs-traces` and homepage acquisition copy only.

## Wire: POST `/api/public/verification-reports`

- **Request body:** UTF-8 JSON matching **`public-verification-report-v3`**: **`{ "schemaVersion": 3, "certificate": <OutcomeCertificateV2> }`** (see [`outcome-certificate-normative.md`](outcome-certificate-normative.md)). **`schemaVersion` 1 / 2 POST bodies are rejected** with **400**.
- **Maximum body size:** **393216** bytes (384 KiB) measured on the raw request bytes before parse. Larger bodies → **413** with JSON **`{ "error": "payload_too_large" }`** (when parse succeeded enough to return JSON).
- **Feature gate:** when **`PUBLIC_VERIFICATION_REPORTS_ENABLED`** is not exactly **`1`**, **`POST`** returns **503** with minimal JSON **`{ "error": "server_error" }`** or empty body per handler; **`GET /r/{id}`** returns **404** for every id (including valid UUID shape) so callers cannot probe enabled state.

## Response: `201 Created`

```json
{ "schemaVersion": 3, "id": "<uuid>", "url": "https://<public-origin>/r/<uuid>" }
```

**`url`** uses the request’s public origin from **`x-forwarded-proto`** / **`x-forwarded-host`** (or **`Host`**) normalized the same way as [`website/src/lib/publicOrigin.ts`](../website/src/lib/publicOrigin.ts).

## Persistence (Postgres)

Table **`shared_verification_report`**:

| Column | Role |
|--------|------|
| **`id`** | UUID primary key |
| **`created_at`** | Insert time |
| **`kind`** | **`outcome_certificate`** for new v3 writes; legacy **`workflow`** / **`quick`** / **`outcome_certificate_v2`** for historical rows |
| **`payload`** | Full validated envelope (jsonb) |
| **`report_workflow_id`** | **`certificate.workflowId`** (modern) or legacy equivalents |
| **`report_status_token`** | **`certificate.stateRelation`** (modern) or legacy equivalents |
| **`human_text`** | **`certificate.humanReport`** (modern) or legacy human text |

**Retention v1:** rows are kept **indefinitely** (no TTL job). Operators may delete by **`id`**:

```sql
DELETE FROM shared_verification_report WHERE id = '<uuid>';
```

## HTML: `GET /r/{id}`

- Server-rendered page using **`VerificationReportView`**: human block + pretty-printed machine JSON from **`payload`**.
- **`metadata.robots`:** `{ index: false, follow: false }`.
- **`metadata.title`:** `AgentSkeptic report — ${report_workflow_id} — ${report_status_token}`.
- **`metadata.description`:** first **240** characters of **`human_text`** with whitespace collapsed to a single line.
- **`X-Robots-Tag: noindex, nofollow`** is also applied via [`website/next.config.ts`](../website/next.config.ts) **`headers`** for **`/r/:path*`**.

## CLI: `--share-report-origin`

- **Batch verify:** optional **`--share-report-origin <https://host>`** — **https only**, **origin only** (path must be **`/`**; no query or fragment; no userinfo). Human stderr during **`verifyWorkflow`** is **suppressed**; after a successful verification and optional bundle write, the CLI **POST**s the **v3** envelope. On **201**, the CLI prints **human report + distribution footer** to stderr, then **one Outcome Certificate JSON** line to stdout, then exits **0 / 1 / 2** as usual. On failure: **exit 3**, **stdout empty**, **stderr exactly one line** — the **`cliErrorEnvelope`** with **`code` `SHARE_REPORT_FAILED`** and **`message`** containing **`share_report_origin=`** and the origin host plus HTTP status / snippet.
- **Quick verify:** same flag and same failure contract; certificate uses CLI **`--workflow-id`** as **`workflowId`** (default **`quick-verify`**).

**`--share-report-origin` is rejected with `enforce` batch/quick** (see [`src/ciLockWorkflow.ts`](../src/ciLockWorkflow.ts)).

## OpenAPI

The **`createPublicVerificationReport`** operation is documented in the synced commercial OpenAPI bundle ([`schemas/openapi-commercial-v1.in.yaml`](../schemas/openapi-commercial-v1.in.yaml)) so agents and integrators discover the path alongside license endpoints.

## Why stderr is deferred when sharing

Exit **3** requires **stderr to be exactly one JSON line** and **stdout empty** ([`docs/agentskeptic.md`](agentskeptic.md) — CLI operational errors). Streaming the human report before a successful POST would violate that contract on POST failure, so the CLI buffers human output until after **201**.

## LangGraph guide

The indexable page **`/guides/verify-langgraph-workflows`** embeds a **regenerated** fixture from **`npm run generate:langgraph-guide-embed`** so SEO content stays aligned with engine output.
