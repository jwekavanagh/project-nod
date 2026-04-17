/**
 * Calls OpenAI Chat Completions with JSON object output (validated afterward with AJV).
 */
export async function callOpenAiRegistryDraftJson(args: {
  prompt: string;
  model: string;
}): Promise<{ ok: true; contentText: string } | { ok: false; status: number; message: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, status: 503, message: "OPENAI_API_KEY missing" };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: "user", content: args.prompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status === 401 || res.status === 403 ? res.status : 503, message: t.slice(0, 500) };
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    return { ok: false, status: 503, message: "empty model content" };
  }

  return { ok: true, contentText: content };
}
