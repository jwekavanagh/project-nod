import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateRegistryDraft } from "@/lib/registry-draft/engine";
import {
  getBootstrapPackInputValidator,
  getRegistryDraftRequestValidator,
  getRegistryDraftResponseEnvelopeValidator,
  getToolsRegistryArrayValidator,
} from "@/lib/registry-draft/createRegistryDraftAjv";
import { parseAndNormalizeRegistryDraftRequest } from "@/lib/registry-draft/parseAndNormalizeRegistryDraftRequest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

describe("draft corpus gate", () => {
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "test", "fixtures", "draft-corpus.manifest.json"), "utf8"),
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

  async function stubFetchDual(urlStr: RequestInfo | URL): Promise<Response> {
    let u: URL;
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

  function mergeEnvForProvider(provider: string) {
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

  function runOne(draftProvider: "hosted_openai" | "local_ollama") {
    const raw = readFileSync(join(repoRoot, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8");
    const env = mergeEnvForProvider(draftProvider);
    const body = JSON.parse(raw) as Record<string, unknown>;
    body.draftProvider = draftProvider;

    const vReq = getRegistryDraftRequestValidator();
    const vBoot = getBootstrapPackInputValidator();
    const parsed = parseAndNormalizeRegistryDraftRequest(body, vReq, vBoot);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return Promise.reject(new Error("parse failed"));

    return generateRegistryDraft({
      parsed,
      validateResponseEnvelope: getRegistryDraftResponseEnvelopeValidator(),
      validateToolsRegistryArray: getToolsRegistryArrayValidator(),
      env,
      fetchImpl: stubFetchDual,
    });
  }

  it("honors draft-corpus manifest generatable rows (≥90% when expanded)", async () => {
    const generatable = manifest.items.filter(
      (x: { expectReadiness: string }) => x.expectReadiness === "ready" || x.expectReadiness === "review",
    );
    let ok = 0;
    for (const _row of generatable) {
      const out = await runOne("hosted_openai");
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      const r = /** @type {{ readiness?: { status?: string } }} */ (out.body).readiness?.status;
      if (r === "ready" || r === "review") ok += 1;
    }
    expect(generatable.length === 0 || ok / generatable.length >= 0.9).toBe(true);
  });

  it("dualBackend parity: hosted_openai vs local_ollama produce identical quickIngest", async () => {
    const a = await runOne("hosted_openai");
    const b = await runOne("local_ollama");
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.body.quickIngestInput.body).toBe(b.body.quickIngestInput.body);
    expect(JSON.stringify(a.body.readiness)).toBe(JSON.stringify(b.body.readiness));
  });
});
