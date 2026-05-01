import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { generateRegistryDraft } from "@/lib/registry-draft/engine";
import {
  getBootstrapPackInputValidator,
  getRegistryDraftRequestValidator,
  getRegistryDraftResponseEnvelopeValidator,
  getToolsRegistryArrayValidator,
} from "@/lib/registry-draft/createRegistryDraftAjv";
import { parseAndNormalizeRegistryDraftRequest } from "@/lib/registry-draft/parseAndNormalizeRegistryDraftRequest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
/** Enumerated denominator (plan baseline). */
const M = 60;

describe("registry-draft fault matrix", () => {
  const raw = readFileSync(join(repoRoot, "test", "fixtures", "registry-draft", "branch-b-envelope.json"), "utf8");
  const previousFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = previousFetch;
  });

  it(`OpenAI unreachable (${M} cases): always structured OPENAI_ERROR`, async () => {
    let structured = 0;
    for (let i = 0; i < M; i++) {
      const badFetch = async () => new Response("upstream", { status: 503 });
      globalThis.fetch = badFetch;

      const body = JSON.parse(raw) as Record<string, unknown>;
      body.draftProvider = "hosted_openai";
      const parsed = parseAndNormalizeRegistryDraftRequest(
        body,
        getRegistryDraftRequestValidator(),
        getBootstrapPackInputValidator(),
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;

      const out = await generateRegistryDraft({
        parsed,
        validateResponseEnvelope: getRegistryDraftResponseEnvelopeValidator(),
        validateToolsRegistryArray: getToolsRegistryArrayValidator(),
        env: { ...process.env, OPENAI_API_KEY: "sk-x", REGISTRY_DRAFT_MODEL: "gpt-4o-mini" },
        fetchImpl: badFetch,
      });

      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect((out.body as { code?: string }).code).toBe("OPENAI_ERROR");
        structured += 1;
      }
    }
    expect(structured).toBe(M);
  }, 120_000);
});
