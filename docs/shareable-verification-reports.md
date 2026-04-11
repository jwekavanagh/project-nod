# Shareable verification reports (normative)

Single source of truth for **public persisted reports**, the **`POST /api/public/verification-reports`** API, **`GET /r/{id}`** HTML, and the **`--share-report-origin`** CLI flag.

## Audiences

- **Engineer:** wire formats, response codes, CLI ordering, exit codes.
- **Integrator:** what gets stored, privacy expectations, LangGraph-shaped ingest (see also [`docs/first-run-integration.md`](first-run-integration.md)).
- **Operator:** environment flags, retention, disabling the surface, manual deletion.

## Trust boundary and privacy (v1)

- The server stores the **exact JSON envelope** accepted by **`schemas/public-verification-report-v1.schema.json`** after AJV validation. **There is no redaction** in v1: tool parameters and human-readable lines may contain secrets. **Do not** publish reports that include credentials or regulated data unless you accept public persistence.
- Reports are **immutable** after insert (no update API v1).

## Wire: POST `/api/public/verification-reports`

- **Request body:** UTF-8 JSON matching **`public-verification-report-v1`** (`kind: workflow` with **`workflowResult`** + **`truthReportText`**, or `kind: quick` with **`workflowDisplayId`**, **`quickReport`**, **`humanReportText`**). Inner **`workflowResult`** must satisfy **`workflow-result`**; inner **`quickReport`** must satisfy **`quick-verify-report`**.
- **Maximum body size:** **393216** bytes (384 KiB) measured on the raw request bytes before parse. Larger bodies → **413** with JSON **`{ "error": "payload_too_large" }`** (when parse succeeded enough to return JSON).
- **Feature gate:** when **`PUBLIC_VERIFICATION_REPORTS_ENABLED`** is not exactly **`1`**, **`POST`** returns **503** with minimal JSON **`{ "error": "server_error" }`** or empty body per handler; **`GET /r/{id}`** returns **404** for every id (including valid UUID shape) so callers cannot probe enabled state.

## Response: `201 Created`

```json
{ "schemaVersion": 1, "id": "<uuid>", "url": "https://<public-origin>/r/<uuid>" }
```

**`url`** uses the request’s public origin from **`x-forwarded-proto`** / **`x-forwarded-host`** (or **`Host`**) normalized the same way as [`website/src/lib/publicOrigin.ts`](../website/src/lib/publicOrigin.ts).

## Persistence (Postgres)

Table **`shared_verification_report`**:

| Column | Role |
|--------|------|
| **`id`** | UUID primary key |
| **`created_at`** | Insert time |
| **`kind`** | **`workflow`** or **`quick`** |
| **`payload`** | Full validated envelope (jsonb) |
| **`report_workflow_id`** | **`workflowResult.workflowId`** or quick **`workflowDisplayId`** |
| **`report_status_token`** | **`workflowResult.status`** or **`quickReport.verdict`** |
| **`human_text`** | Duplicate of **`truthReportText`** / **`humanReportText`** for fast render and OG description |

**Retention v1:** rows are kept **indefinitely** (no TTL job). Operators may delete by **`id`**:

```sql
DELETE FROM shared_verification_report WHERE id = '<uuid>';
```

## HTML: `GET /r/{id}`

- Server-rendered page using **`VerificationReportView`**: human block + pretty-printed machine JSON from **`payload`**.
- **`metadata.robots`:** `{ index: false, follow: false }`.
- **`metadata.title`:** `Workflow Verifier report — ${report_workflow_id} — ${report_status_token}`.
- **`metadata.description`:** first **240** characters of **`human_text`** with whitespace collapsed to a single line.
- **`X-Robots-Tag: noindex, nofollow`** is also applied via [`website/next.config.ts`](../website/next.config.ts) **`headers`** for **`/r/:path*`**.

## CLI: `--share-report-origin`

- **Batch verify:** optional **`--share-report-origin <https://host>`** — **https only**, **origin only** (path must be **`/`**; no query or fragment; no userinfo). Human stderr during **`verifyWorkflow`** is **suppressed**; after a successful verification and optional bundle write, the CLI **POST**s the envelope. On **201**, the CLI prints **human report + distribution footer** to stderr, then **one line `WorkflowResult` JSON** to stdout, then exits **0 / 1 / 2** as usual. On failure: **exit 3**, **stdout empty**, **stderr exactly one line** — the **`cliErrorEnvelope`** with **`code` `SHARE_REPORT_FAILED`** and **`message`** containing **`share_report_origin=`** and the origin host plus HTTP status / snippet.
- **Quick verify:** same flag and same failure contract; **`workflowDisplayId`** is the CLI **`--workflow-id`** value (default **`quick-verify`**).

**`--share-report-origin` is rejected with `enforce` batch/quick** (see [`src/ciLockWorkflow.ts`](../src/ciLockWorkflow.ts)).

## OpenAPI

The **`createPublicVerificationReport`** operation is documented in the synced commercial OpenAPI bundle ([`schemas/openapi-commercial-v1.in.yaml`](../schemas/openapi-commercial-v1.in.yaml)) so agents and integrators discover the path alongside license endpoints.

## Why stderr is deferred when sharing

Exit **3** requires **stderr to be exactly one JSON line** and **stdout empty** ([`docs/workflow-verifier.md`](workflow-verifier.md) — CLI operational errors). Streaming the human report before a successful POST would violate that contract on POST failure, so the CLI buffers human output until after **201**.

## LangGraph guide

The indexable page **`/guides/verify-langgraph-workflows`** embeds a **regenerated** fixture from **`npm run generate:langgraph-guide-embed`** so SEO content stays aligned with engine output.
