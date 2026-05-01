# Hosted registry draft — SSOT

Normative contract for the **optional** same-origin **`POST /api/integrator/registry-draft`** HTTP surface on the canonical website deployment: JSON Schema **`$id` / `$ref` policy**, **fixed** AJV **`addSchema` order**, **DraftEngine** orchestration in **`website/src/lib/registry-draft/engine.ts`** (`generateRegistryDraft`), provider matrix, readiness scoring, synthesis import rules for tests, and the **commercial validation harness** markers (`scripts/validate-commercial-funnel.mjs`).

**Audience:** engineers changing registry-draft schemas, **`website/src/lib/registry-draft/`**, **`agentskeptic/bootstrapPackSynthesis`** (NDJSON synthesis), **`scripts/validate-commercial-funnel.mjs`**, or the **Vitest** suite under **`website/__tests__/registry-draft/`**.

## DraftEngine (single pipeline)

Normative drafting from OpenAI-bootstrap inputs is implemented once in **`website/src/lib/registry-draft/engine.ts`**.  
The Python package **`emit_tools_json`** helper remains a minimal template generator for onboarding-style examples — not a semantic peer to DraftEngine. Libraries that require LM-backed drafts **should call the deployed HTTP endpoint** (**`POST /api/integrator/registry-draft`** on your site origin ) with the request envelope, integrate the **guided** Next.js drafting flow where appropriate, **or** hand-author **`tools.json`**; **do not** fork a parallel Python LM stack in this repo.

## JSON Schema `$ref` strategy

1. Every shared schema file declares a canonical HTTPS **`$id`** under `https://agentskeptic.com/schemas/<file-basename>.json` (same pattern as other repo schemas).

2. Every cross-file reference uses **only** that absolute URI in `"$ref"`. No relative `./foo.json` or fragment-only refs between files.

3. **Registry-draft** uses a **dedicated** `Ajv` instance from **`website/src/lib/registry-draft/createRegistryDraftAjv.ts`** (**website Vitest suites** + DraftEngine imports). **Do not** add registry-draft schemas to ad-hoc website-local AJV factories outside this pipeline.

4. **CLI bootstrap** (kernel) uses **`src/schemaLoad.ts`** for **`bootstrap-pack-input-v1`**. That loader **`addSchema`s the OpenAI tool-call item schema before the bootstrap pack** so `$ref` resolution matches production order.

5. Published npm tarball includes **`schemas/`** (see root **`package.json` `"files"`**) so bootstrap pack, tools-registry, and related JSON files ship with the package.

### AJV `addSchema` order (registry-draft instance)

| Order | Schema `$id` |
|-------|----------------|
| 1 | `https://agentskeptic.com/schemas/openai-function-tool-call-item-v1.schema.json` |
| 2 | `https://agentskeptic.com/schemas/bootstrap-pack-input-v1.schema.json` |
| 3 | `https://agentskeptic.com/schemas/registry-draft-request-v1.schema.json` |
| 4 | `https://agentskeptic.com/schemas/registry-draft-response.schema.json` |
| 5 | `https://agentskeptic.com/schemas/tools-registry.schema.json` |

**Response** uses the **same** factory and order as request: envelope is validated at step **4**; **`draft.tools`** is validated with step **5**.

## Request and response authority

- **Request:** **`schemas/registry-draft-request-v1.schema.json`** — **`oneOf`**: **`bootstrap_pack_v1`** \| **`openai_tool_calls_v1`**; shared **`$defs`** for **`workflowId`**, optional **`draftProvider`** (**`hosted_openai`** \| **`local_ollama`**, default **hosted** when omitted), and **`ddlHint`** (**`ddlHint`** pattern rejects **`://`**).

- **Response (HTTP 200):** **`schemas/registry-draft-response.schema.json`** — single SSOT (**`schemaVersion: 3`**). Includes **`draft.tools`** (**`tools-registry`** array), **`generation.backend`**, **`generation.model`**, required **`readiness.status`** (**`ready`** \| **`review`** \| **`blocked`**) and **`readiness.reasons`**, plus required **`quickIngestInput`**: UTF-8 NDJSON computed **deterministically** in DraftEngine from the normalized bootstrap input (same as **`synthesizeQuickInputUtf8FromOpenAiV1`**). The hosted / Ollama call returns a **partial** object only; the server merges before AJV. Partial shape reference: **`schemas/registry-draft-llm-partial-v1.schema.json`** (hosted path also uses this in **`response_format.json_schema`**; Ollama uses **`format: "json"`** plus the same merge rules).

**`quickIngestInput`:** Present on every **200** after a successful model parse and merge. **`body`** max length **65536** (aligned with the route request cap). Failing synthesis returns **500** with **`code: QUICK_INGEST_SYNTHESIS_FAILED`**.

- **Website** imports **`@/lib/registry-draft/*`** modules from the App Router (**`website/src/app/api/integrator/registry-draft/route.ts`**) — no second AJV construction path separate from **`createRegistryDraftAjv`** for this route.

## Provider matrix (no silent failover)

| `draftProvider` | Credentials / env | Wire |
|-----------------|-------------------|------|
| `hosted_openai` (default) | `OPENAI_API_KEY`, optional `REGISTRY_DRAFT_MODEL` | OpenAI Chat Completions + `json_schema` partial (`website/src/lib/registry-draft/providers/hosted_openai.ts`) |
| `local_ollama` | `AGENTSKEPTIC_DRAFT_LOCAL_MODEL`, optional `OLLAMA_HOST` (default `http://127.0.0.1:11434`) | `POST {OLLAMA_HOST}/api/chat` with `format: "json"` (`website/src/lib/registry-draft/providers/local_ollama.ts`) |

There is **no** automatic hosted↔local failover. A different backend requires a **new** request with an explicit **`draftProvider`**.

### Readiness (falsifiable)

Computed in **`website/src/lib/registry-draft/readiness.ts`** after tools-registry validation:

- **`ready`:** no assumptions, no warnings, no unresolved JSON pointers required by **`draft.tools`** against merged tool **`arguments`** from the bootstrap pack.
- **`review`:** otherwise when merge succeeded.
- **`blocked`:** not used for HTTP **200** success; provider / merge failures return **502/503** JSON error bodies with a **`code`** field (not the full v3 envelope).

## Website route limits (cost and abuse)

- **Feature gate:** **`REGISTRY_DRAFT_ENABLED`** on the website process; when off, the route returns **404**. Missing credentials for the selected **`draftProvider`** return **503** with **`code: CONFIG_MISSING`**.
- **Same-origin:** browser **`Origin`** / **`Referer`** must match the canonical site origin.
- **Body size:** UTF-8 request cap **65536** bytes.
- **Per-IP hourly cap:** **`REGISTRY_DRAFT_IP_CAP`** and **`reserveRegistryDraftIpSlot`** (see **`website/src/lib/ossClaimRateLimits.ts`** when shared). A slot is reserved only after the request **JSON validates**; each successful reservation can proceed to DraftEngine. Over the cap for that IP in the current UTC hour → **429** (no provider call).

## NDJSON synthesis (server + tests)

- Single NDJSON authority for quick-ingest synthesis: **`synthesizeQuickInputUtf8FromOpenAiV1`** (**exported via** **`agentskeptic/bootstrapPackSynthesis`** **from kernel** **npm** tarball). DraftEngine attaches the same bytes as **`quickIngestInput.body`** in the v3 response.

- **Integrator UX:** **`guided-first-verification.md`** — one-page flow; no separate manual synthesis step in the default guided path.

- Vitest suites under **`website/__tests__/registry-draft/`** consume merged responses and deterministic fixtures (**no duplicated NDJSON derivation outside DraftEngine bootstrap synthesis** boundaries).

## Commercial harness (provable in code)

In **`scripts/validate-commercial-funnel.mjs`**, after the OSS-restore **`npm run build`** that follows **`pack-smoke-commercial.mjs`**:

- The build line is preceded by **`// BUILD:postPackSmokeOssRestore`** and **`// PHASE:postPackSmokeOssRestoreBuild`** (exact text, adjacent as specified in the harness contract test).

- **Immediately after** that build succeeds, the script invokes **`runRegistryDraftOutcomeHarness(root)`** exactly once (helper marker **`// REGISTRY_DRAFT_OUTCOME_HARNESS`**).

That harness runs **`npm run test:vitest -w agentskeptic-web -- __tests__/registry-draft`** (Vitest discovery; cwd is **`website/`**). **Forbidden:** asserting harness wiring only via **`execSync` greps** of this script instead of **`test/validate-commercial-funnel-registry-draft-harness.test.mjs`** contract coverage.

## Binary validation

**Solved** when **`npm run validate-commercial`** exits **0** (includes the harness sequence and website checks per **`scripts/validate-commercial-funnel.mjs`**).
