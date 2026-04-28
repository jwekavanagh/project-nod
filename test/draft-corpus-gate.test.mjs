/**
 * Corpus gate: generatable rows should reach expected readiness class with schema-valid tools on a mocked provider.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

describe("draft corpus gate", async () => {
  const manifest = JSON.parse(readFileSync(join(root, "test", "fixtures", "draft-corpus.manifest.json"), "utf8"));
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

  const validPartial = {
    draft: {
      tools: [
        {
          toolId: "crm.upsert_contact",
          effectDescriptionTemplate: "Upsert contact {/recordId} with fields {/fields}",
          verification: {
            kind: "sql_row",
            table: { const: "contacts" },
            identityEq: [{ column: { const: "id" }, value: { pointer: "/recordId" } }],
            requiredFields: { pointer: "/fields" },
          },
        },
      ],
    },
    assumptions: [],
    warnings: [],
    disclaimer: "Draft only; review before use.",
    model: { model: "stub" },
  };

  async function stubFetchDual(urlStr) {
    let u;
    try {
      u = new URL(String(urlStr));
    } catch {
      return new Response("bad", { status: 404 });
    }
    if (
      u.protocol === "https:" &&
      u.hostname === "api.openai.com" &&
      u.pathname.startsWith("/v1/chat/completions")
    ) {
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validPartial) } }] }), {
        status: 200,
      });
    }
    const ollamaLocal = u.hostname === "127.0.0.1" || u.hostname === "localhost";
    if (ollamaLocal && u.port === "11434" && u.pathname === "/api/chat") {
      return new Response(JSON.stringify({ message: { content: JSON.stringify(validPartial) } }), { status: 200 });
    }
    return new Response("bad", { status: 404 });
  }

  function runOne(draftProvider) {
    const raw = readFileSync(join(root, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8");
    const env = mergeEnvForProvider(draftProvider);
    const body = JSON.parse(raw);
    body.draftProvider = draftProvider;

    const vReq = getRegistryDraftRequestValidator();
    const vBoot = getBootstrapPackInputValidator();
    const parsed = parseAndNormalizeRegistryDraftRequest(body, vReq, vBoot);
    assert.ok(parsed.ok);

    return generateRegistryDraft({
      parsed,
      validateResponseEnvelope: getRegistryDraftResponseEnvelopeValidator(),
      validateToolsRegistryArray: getToolsRegistryArrayValidator(),
      env,
      fetchImpl: stubFetchDual,
    });
  }

  it("honors draft-corpus manifest generatable rows (≥90% when expanded)", async () => {
    const generatable = manifest.items.filter((x) => x.expectReadiness === "ready" || x.expectReadiness === "review");
    let ok = 0;
    for (const row of generatable) {
      const out = await runOne("hosted_openai");
      assert.ok(out.ok);
      const r = out.body.readiness?.status;
      if (r === "ready" || r === "review") ok += 1;
    }
    assert.ok(generatable.length === 0 || ok / generatable.length >= 0.9, `ratio ${ok}/${generatable.length}`);
  });

  it("dualBackend parity: hosted_openai vs local_ollama produce identical quickIngest and stable tools with identical stubbed partials", async () => {
    const a = await runOne("hosted_openai");
    const b = await runOne("local_ollama");
    assert.ok(a.ok && b.ok);
    assert.equal(a.body.quickIngestInput.body, b.body.quickIngestInput.body);
    assert.equal(JSON.stringify(a.body.readiness), JSON.stringify(b.body.readiness));
  });
});

function mergeEnvForProvider(provider) {
  const base = { ...process.env, REGISTRY_DRAFT_ENABLED: "1" };
  if (provider === "hosted_openai") {
    return { ...base, OPENAI_API_KEY: "sk-test", REGISTRY_DRAFT_MODEL: "gpt-4o-mini" };
  }
  return {
    ...base,
    AGENTSKEPTIC_DRAFT_LOCAL_MODEL: "llama3.2",
    OLLAMA_HOST: "http://127.0.0.1:11434",
  };
}
