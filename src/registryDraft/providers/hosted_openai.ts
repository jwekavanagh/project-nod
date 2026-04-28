import { getOpenAiRegistryDraftLlmResponseJsonSchemaRoot } from "../openAiLlmResponseSchema.js";
import type { FetchWithRetryResult } from "../draftEnv.js";
import { draftHttpTimeoutMs, fetchWithTransientRetry } from "../draftEnv.js";

/**
 * OpenAI Chat Completions with `response_format.json_schema` (LLM partial).
 */
function openAiJsonSchemaPayload(root: Record<string, unknown>): Record<string, unknown> {
  const out = { ...root };
  delete out["$schema"];
  delete out["$id"];
  delete out["title"];
  delete out["description"];
  return out;
}

export type HostedOpenAiResult =
  | { ok: true; contentText: string }
  | { ok: false; status: number; message: string };

export async function callHostedOpenAiRegistryDraftJson(args: {
  prompt: string;
  model: string;
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<HostedOpenAiResult> {
  const key = (args.env["OPENAI_API_KEY"] ?? "").trim();
  if (!key) {
    return { ok: false, status: 503, message: "OPENAI_API_KEY missing" };
  }

  const fetchFn = args.fetchImpl ?? globalThis.fetch;
  const schemaRoot = openAiJsonSchemaPayload(getOpenAiRegistryDraftLlmResponseJsonSchemaRoot());

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), draftHttpTimeoutMs(args.env));
  let res: FetchWithRetryResult | undefined;
  try {
    res = await fetchWithTransientRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          messages: [{ role: "user", content: args.prompt }],
          temperature: 0,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "RegistryDraftLlmPartialV1",
              strict: false,
              schema: schemaRoot,
            },
          },
        }),
        signal: ac.signal,
      },
      { timeouts: [100, 250], fetchFn },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    clearTimeout(t);
    if (msg.includes("abort") || ac.signal.aborted) {
      return { ok: false, status: 503, message: "PROVIDER_TIMEOUT" };
    }
    return { ok: false, status: 503, message: msg.slice(0, 500) };
  } finally {
    clearTimeout(t);
  }

  if (!res || !res.ok) {
    return { ok: false, status: res?.status ?? 503, message: res?.message ?? "OPENAI_ERROR" };
  }

  try {
    const body = JSON.parse(res.text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return { ok: false, status: 503, message: "empty model content" };
    }
    return { ok: true, contentText: content };
  } catch {
    return { ok: false, status: 503, message: "OPENAI_PARSE_ERROR" };
  }
}
