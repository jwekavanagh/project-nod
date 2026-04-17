# Hosted registry draft — SSOT

Normative contract for the **optional** same-origin **`POST /api/integrator/registry-draft`** surface: JSON Schema `$id` / `$ref` policy, **fixed** AJV `addSchema` order, request vs response validation, synthesis import rules for tests, and the **commercial validation harness** markers that prove wiring without Vitest grepping the script.

**Audience:** engineers changing schemas, `agentskeptic/registryDraft`, `agentskeptic/bootstrapPackSynthesis`, `scripts/validate-commercial-funnel.mjs`, or the root `node:test` harness files.

## JSON Schema `$ref` strategy

1. Every shared schema file declares a canonical HTTPS **`$id`** under `https://agentskeptic.com/schemas/<file-basename>.json` (same pattern as other repo schemas).

2. Every cross-file reference uses **only** that absolute URI in `"$ref"`. No relative `./foo.json` or fragment-only refs between files.

3. **Registry-draft** uses a **dedicated** `Ajv` instance from `src/registryDraft/createRegistryDraftAjv.ts` (website + root registry-draft tests). **Do not** add registry-draft schemas to ad-hoc website-local AJV factories.

4. **CLI bootstrap** uses `src/schemaLoad.ts` for `bootstrap-pack-input-v1`. That loader **`addSchema`s the OpenAI tool-call item schema before the bootstrap pack** so `$ref` resolution matches production order.

5. Published npm tarball includes `schemas/` (see root `package.json` `"files"`) so all five JSON files ship with the package.

### AJV `addSchema` order (registry-draft instance)

| Order | Schema `$id` |
|-------|----------------|
| 1 | `https://agentskeptic.com/schemas/openai-function-tool-call-item-v1.schema.json` |
| 2 | `https://agentskeptic.com/schemas/bootstrap-pack-input-v1.schema.json` |
| 3 | `https://agentskeptic.com/schemas/registry-draft-request-v1.schema.json` |
| 4 | `https://agentskeptic.com/schemas/registry-draft-response-v1.schema.json` |
| 5 | `https://agentskeptic.com/schemas/tools-registry.schema.json` |

**Response** uses the **same** factory and order as request: envelope is validated at step 4; `draft.tools` is validated with step 5.

## Request and response authority

- **Request:** `schemas/registry-draft-request-v1.schema.json` — `oneOf`: `bootstrap_pack_v1` | `openai_tool_calls_v1`; shared `$defs` for `workflowId` and `ddlHint` (`ddlHint` pattern rejects `://`).

- **Response:** `schemas/registry-draft-response-v1.schema.json` — envelope + `draft.tools` as `tools-registry` array.

- **Website** imports **`agentskeptic/registryDraft`** only for AJV-backed validation and normalization—no second AJV construction path under `website/` for this route.

## NDJSON synthesis (tests)

- Single NDJSON authority for quick-ingest synthesis: `synthesizeQuickInputUtf8FromOpenAiV1` (exported via **`agentskeptic/bootstrapPackSynthesis`**).

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
