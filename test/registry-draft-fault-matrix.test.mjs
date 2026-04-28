/**
 * R5-style stability: synthetic provider failures yield structured `{ code }` bodies (deterministic failure class).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
/** Enumerated denominator (plan baseline). */
const M = 60;

describe("registry-draft fault matrix", async () => {
  const { generateRegistryDraft } = await import(
    pathToFileURL(join(root, "dist", "registryDraft", "engine.js")).href
  );
  const {
    getRegistryDraftRequestValidator,
    getBootstrapPackInputValidator,
    getRegistryDraftResponseEnvelopeValidator,
    getToolsRegistryArrayValidator,
  } = await import(pathToFileURL(join(root, "dist", "registryDraft", "createRegistryDraftAjv.js")).href);
  const { parseAndNormalizeRegistryDraftRequest } = await import(
    pathToFileURL(join(root, "dist", "registryDraft", "parseAndNormalizeRegistryDraftRequest.js")).href
  );

  const raw = readFileSync(join(root, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8");

  it(`OpenAI unreachable (${M} cases): always structured OPENAI_ERROR`, async () => {
    let structured = 0;
    for (let i = 0; i < M; i++) {
      globalThis.fetch = async () => new Response("upstream", { status: 503 });

      const body = JSON.parse(raw);
      body.draftProvider = "hosted_openai";
      const parsed = parseAndNormalizeRegistryDraftRequest(
        body,
        getRegistryDraftRequestValidator(),
        getBootstrapPackInputValidator(),
      );
      assert.ok(parsed.ok);

      const out = await generateRegistryDraft({
        parsed,
        validateResponseEnvelope: getRegistryDraftResponseEnvelopeValidator(),
        validateToolsRegistryArray: getToolsRegistryArrayValidator(),
        env: { ...process.env, OPENAI_API_KEY: "sk-x", REGISTRY_DRAFT_MODEL: "gpt-4o-mini" },
        fetchImpl: globalThis.fetch,
      });

      assert.equal(out.ok, false);
      assert.equal(out.body.code, "OPENAI_ERROR");
      structured += 1;
    }
    assert.equal(structured, M);
  });
});
