import { getOpenAiRegistryDraftLlmResponseJsonSchemaRoot } from "../openAiLlmResponseSchema.js";
import type { FetchWithRetryResult } from "../draftEnv.js";
import { defaultOllamaChatUrl, draftHttpTimeoutMs, fetchWithTransientRetry } from "../draftEnv.js";

/** Ollama `POST /api/chat` — `format: "json"` forces JSON-only content in `message.content`. */

function openAiJsonSchemaPayload(root: Record<string, unknown>): Record<string, unknown> {
  const out = { ...root };
  delete out["$schema"];
  delete out["$id"];
  delete out["title"];
  delete out["description"];
  return out;
}

export type LocalOllamaResult =
  | { ok: true; contentText: string }
  | { ok: false; status: number; message: string };

export async function callLocalOllamaRegistryDraftJson(args: {
  prompt: string;
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<LocalOllamaResult> {
  const fetchFn = args.fetchImpl ?? globalThis.fetch;
  const model = (args.env["AGENTSKEPTIC_DRAFT_LOCAL_MODEL"] ?? "").trim();
  if (!model) {
    return { ok: false, status: 503, message: "AGENTSKEPTIC_DRAFT_LOCAL_MODEL missing" };
  }

  const timeoutMs = draftHttpTimeoutMs(args.env);
  const url = defaultOllamaChatUrl(args.env);
  /** Ask Ollama to emit JSON-shaped output for downstream partial parse parity with hosted `_partial` schema prose in prompt body. */
  const schemaGuide = JSON.stringify(openAiJsonSchemaPayload(getOpenAiRegistryDraftLlmResponseJsonSchemaRoot()));
  const userContent =
    `${args.prompt}\n\nStrict output: conform to this JSON shape (RFC JSON only, no prose): ${schemaGuide.slice(0, 12000)}`;

  const ac = new AbortController();
  const tm = setTimeout(() => ac.abort(), timeoutMs);
  let res: FetchWithRetryResult | undefined;
  try {
    res = await fetchWithTransientRetry(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          model,
          stream: false,
          format: "json",
          messages: [{ role: "user", content: userContent }],
        }),
      },
      { timeouts: [100, 250], fetchFn },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    clearTimeout(tm);
    if (ac.signal.aborted || msg.includes("abort")) {
      return { ok: false, status: 503, message: "PROVIDER_TIMEOUT" };
    }
    return { ok: false, status: 503, message: msg.slice(0, 500) };
  } finally {
    clearTimeout(tm);
  }

  if (!res || !res.ok) {
    return { ok: false, status: res?.status ?? 503, message: res?.message ?? "OLLAMA_ERROR" };
  }

  try {
    const body = JSON.parse(res.text) as {
      message?: { content?: string };
    };
    const content =
      typeof body.message?.content === "string"
        ? body.message.content
        : typeof body === "object" && body !== null && "response" in body
          ? String((body as { response?: string }).response ?? "")
          : "";
    /** Some Ollama builds return structured object already */
    let textOut = content;
    if (!textOut && typeof body.message?.content === "object" && body.message.content !== null) {
      textOut = JSON.stringify(body.message.content);
    }
    if (typeof textOut !== "string" || textOut.length === 0) {
      return { ok: false, status: 503, message: "empty ollama model content" };
    }
    return { ok: true, contentText: textOut };
  } catch {
    return { ok: false, status: 503, message: "OLLAMA_PARSE_ERROR" };
  }
}
