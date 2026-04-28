import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOpenAiRegistryDraftLlmResponseJsonSchemaRoot } from "agentskeptic/registryDraft";
import { callHostedOpenAiRegistryDraftJson } from "agentskeptic/registryDraft/providers/hosted_openai";

const fetchMock = vi.fn();

describe("callHostedOpenAiRegistryDraftJson", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test";
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"draft":{"tools":[]}}' } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POSTs with json_schema response_format for the LLM partial; schema matches stripped on-disk Llm root", async () => {
    const r = await callHostedOpenAiRegistryDraftJson({ prompt: "p", model: "gpt-4o-mini", env: process.env });
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init?.body as string) ?? "{}") as {
      response_format: { type: string; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
    };
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("RegistryDraftLlmPartialV1");
    expect(body.response_format.json_schema.strict).toBe(false);
    const root = { ...getOpenAiRegistryDraftLlmResponseJsonSchemaRoot() } as Record<string, unknown>;
    delete root["$schema"];
    delete root["$id"];
    delete root["title"];
    delete root["description"];
    expect(body.response_format.json_schema.schema).toEqual(root);
  });
});
