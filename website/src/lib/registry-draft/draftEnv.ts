/**
 * Environment surface for DraftEngine (hosted OpenAI + local Ollama). No silent cross-provider fallback.
 */
export function draftHttpTimeoutMs(env: NodeJS.ProcessEnv): number {
  const raw = env["AGENTSKEPTIC_DRAFT_HTTP_TIMEOUT_MS"];
  if (raw === undefined || raw === "") return 120_000;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}

export function defaultOllamaChatUrl(env: NodeJS.ProcessEnv): string {
  const raw = (env["OLLAMA_HOST"] ?? "http://127.0.0.1:11434").trim();
  const withScheme =
    raw.length === 0
      ? "http://127.0.0.1:11434"
      : /^[a-zA-Z][a-zA-Z+\-.]*:/.test(raw)
        ? raw
        : `http://${raw}`;
  try {
    const u = new URL(withScheme);
    return new URL("/api/chat", `${u.origin}/`).href;
  } catch {
    return "http://127.0.0.1:11434/api/chat";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type FetchWithRetryResult =
  | { ok: true; status: number; text: string }
  | { ok: false; status: number; message: string };

/** Bounded retry for idempotent POST (OpenAI / Ollama) on 502/529/503 transient. */
export async function fetchWithTransientRetry(
  url: string,
  init: RequestInit,
  opts: { timeouts: number[]; fetchFn?: typeof fetch },
): Promise<FetchWithRetryResult> {
  const f = opts.fetchFn ?? globalThis.fetch;
  for (let attempt = 0; attempt <= opts.timeouts.length; attempt++) {
    const res = await f(url, init);
    const text = await res.text();
    if (res.ok) {
      return { ok: true, status: res.status, text };
    }
    const retryable = res.status === 502 || res.status === 503 || res.status === 429;
    if (!retryable || attempt === opts.timeouts.length) {
      const st = res.status === 401 || res.status === 403 ? res.status : 503;
      return { ok: false, status: st, message: `PROVIDER_HTTP_${res.status}` };
    }
    await sleep(opts.timeouts[attempt]!);
  }
  return { ok: false, status: 503, message: "PROVIDER_HTTP_503" };
}
