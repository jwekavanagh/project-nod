# Hosted registry draft — SSOT

Normative contract for the **optional** same-origin **`POST /api/integrator/registry-draft`** surface **and** the matching CLI **`agentskeptic registry-draft`**: JSON Schema `$id` / `$ref` policy, **fixed** AJV `addSchema` order, **DraftEngine** orchestration in `src/registryDraft/engine.ts`, provider matrix, readiness scoring, synthesis import rules for tests, and the **commercial validation harness** markers.

**Audience:** engineers changing schemas, `agentskeptic/registryDraft`, `agentskeptic/bootstrapPackSynthesis`, `scripts/validate-commercial-funnel.mjs`, or the root `node:test` harness files.

## DraftEngine (single pipeline)

Normative drafting from OpenAI-bootstrap inputs is implemented once in **`src/registryDraft/engine.ts`** (`generateRegistryDraft`).  
The Python package’s **`emit_tools_json`** helper remains a minimal template generator for onboarding-style examples—not a semantic peer to DraftEngine. Libraries that require LM-backed drafts **should invoke the CLI** (`agentskeptic registry-draft …`) via subprocess against a request JSON envelope, **or** hand-author `tools.json`; **do not** fork a parallel Python LM stack in this repo.

## JSON Schema `$ref` strategy

1. Every shared schema file declares a canonical HTTPS **`$id`** under `https://agentskeptic.com/schemas/<file-basename>.json` (same pattern as other repo schemas).

2. Every cross-file reference uses **only** that absolute URI in `"$ref"`. No relative `./foo.json` or fragment-only refs between files.

3. **Registry-draft** uses a **dedicated** `Ajv` instance from `src/registryDraft/createRegistryDraftAjv.ts` (website + root registry-draft tests). **Do not** add registry-draft schemas to ad-hoc website-local AJV factories.

4. **CLI bootstrap** uses `src/schemaLoad.ts` for `bootstrap-pack-input-v1`. That loader **`addSchema`s the OpenAI tool-call item schema before the bootstrap pack** so `$ref` resolution matches production order.

5. Published npm tarball includes `schemas/` (see root `package.json` `"files"`) so registry-draft, tools-registry, and related JSON files ship with the package.

### AJV `addSchema` order (registry-draft instance)

| Order | Schema `$id` |
|-------|----------------|
| 1 | `https://agentskeptic.com/schemas/openai-function-tool-call-item-v1.schema.json` |
| 2 | `https://agentskeptic.com/schemas/bootstrap-pack-input-v1.schema.json` |
| 3 | `https://agentskeptic.com/schemas/registry-draft-request-v1.schema.json` |
| 4 | `https://agentskeptic.com/schemas/registry-draft-response.schema.json` |
| 5 | `https://agentskeptic.com/schemas/tools-registry.schema.json` |

**Response** uses the **same** factory and order as request: envelope is validated at step 4; `draft.tools` is validated with step 5.

## Request and response authority

- **Request:** `schemas/registry-draft-request-v1.schema.json` — `oneOf`: `bootstrap_pack_v1` | `openai_tool_calls_v1`; shared `$defs` for `workflowId`, optional **`draftProvider`** (`hosted_openai` \| `local_ollama`, default **hosted** when omitted), and `ddlHint` (`ddlHint` pattern rejects `://`).

- **Response (HTTP 200):** `schemas/registry-draft-response.schema.json` — single SSOT (`schemaVersion: **3**`). Includes **`draft.tools`** (`tools-registry` array), **`generation.backend`**, **`generation.model`**, required **`readiness.status`** (`ready` \| `review` \| `blocked`) and **`readiness.reasons`**, plus required **`quickIngestInput`**: UTF-8 NDJSON computed **deterministically** in DraftEngine from the normalized bootstrap input (same as `synthesizeQuickInputUtf8FromOpenAiV1`). The hosted / Ollama call returns a **partial** object only; the server merges before AJV. Partial shape reference: `schemas/registry-draft-llm-partial-v1.schema.json` (hosted path also uses this in `response_format.json_schema`; Ollama uses `format: "json"` plus the same merge rules).

**`quickIngestInput`:** Present on every **200** after a successful model parse and merge. `body` max length **65536** (aligned with the route request cap). Failing synthesis returns **500** with `code: QUICK_INGEST_SYNTHESIS_FAILED`.

- **Website** imports **`agentskeptic/registryDraft`** only for AJV-backed validation and DraftEngine—no second AJV construction path under `website/` for this route.

## Provider matrix (no silent fallback)

| `draftProvider` | Credentials / env | Wire |
|-----------------|-------------------|------|
| `hosted_openai` (default) | `OPENAI_API_KEY`, optional `REGISTRY_DRAFT_MODEL` | OpenAI Chat Completions + `json_schema` partial (`src/registryDraft/providers/hosted_openai.ts`) |
| `local_ollama` | `AGENTSKEPTIC_DRAFT_LOCAL_MODEL`, optional `OLLAMA_HOST` (default `http://127.0.0.1:11434`) | `POST {OLLAMA_HOST}/api/chat` with `format: "json"` (`src/registryDraft/providers/local_ollama.ts`) |

There is **no** automatic hosted↔local failover. A different backend requires a **new** request with an explicit `draftProvider` (or CLI `--provider`).

### Readiness (falsifiable)

Computed in `src/registryDraft/readiness.ts` after tools-registry validation:

- **`ready`:** no assumptions, no warnings, no unresolved JSON pointers required by `draft.tools` against merged tool `arguments` from the bootstrap pack.
- **`review`:** otherwise when merge succeeded.
- **`blocked`:** not used for HTTP **200** success; provider / merge failures return **502/503** JSON error bodies with a `code` field (not the full v3 envelope).

## Website route limits (cost and abuse)

- **Feature gate:** `REGISTRY_DRAFT_ENABLED` on the website process; when off, the route returns **404**. Missing credentials for the selected `draftProvider` return **503** with `code: CONFIG_MISSING`.
- **Same-origin:** browser `Origin` / `Referer` must match the canonical site origin.
- **Body size:** UTF-8 request cap **65536** bytes.
- **Per-IP hourly cap:** `REGISTRY_DRAFT_IP_CAP` and `reserveRegistryDraftIpSlot` in [`website/src/lib/ossClaimRateLimits.ts`](../website/src/lib/ossClaimRateLimits.ts). A slot is reserved only after the request **JSON validates**; each successful reservation can proceed to DraftEngine. Over the cap for that IP in the current UTC hour → **429** (no provider call).

## NDJSON synthesis (server + tests)

- Single NDJSON authority for quick-ingest synthesis: `synthesizeQuickInputUtf8FromOpenAiV1` (exported via **`agentskeptic/bootstrapPackSynthesis`**). DraftEngine attaches the same bytes as **`quickIngestInput.body`** in the v3 response.

- **Integrator UX:** [guided-first-verification.md](guided-first-verification.md) — one-page flow; no separate manual synthesis step in the default path.

- **`test/registry-draft-outcome-chain.test.mjs`** must obtain the NDJSON buffer **only** from `synthesizeQuickInputUtf8FromOpenAiV1(parsed)` when asserting the CLI `quick` path.

- **`test/registry-draft-outcome-chain-import-guard.test.mjs`** proves a **single** static import line matching `from "agentskeptic/bootstrapPackSynthesis"` with `synthesizeQuickInputUtf8FromOpenAiV1` in the binding (no scanning of NDJSON file contents).

## Commercial harness (provable in code)

In `scripts/validate-commercial-funnel.mjs`, after the OSS-restore **`npm run build`** that follows `pack-smoke-commercial.mjs`:

- The build line is preceded by **`// BUILD:postPackSmokeOssRestore`** and **`// PHASE:postPackSmokeOssRestoreBuild`** (exact text, adjacent as specified in the harness contract test).

- **Immediately after** that build succeeds, the script calls **`await runRegistryDraftOutcomeHarness(root)`** exactly once. The helper body starts with **`// REGISTRY_DRAFT_OUTCOME_HARNESS`**.

**`runRegistryDraftOutcomeHarness`** runs **only** root **`node --test`** (no Vitest script greps), in order:

1. `test/validate-commercial-funnel-registry-draft-harness.test.mjs` — textual assertions on the script.
2. `test/registry-draft-contract.test.mjs`
3. `test/registry-draft-outcome-chain-import-guard.test.mjs`
4. `test/registry-draft-outcome-chain.test.mjs`

**Forbidden:** Vitest-based harness verification or `execSync` greps of `validate-commercial-funnel.mjs` as a substitute for the structure test above.

## Binary validation

**Solved** when `npm run validate-commercial` exits **0** (includes the harness sequence and website checks per `scripts/validate-commercial-funnel.mjs`).
