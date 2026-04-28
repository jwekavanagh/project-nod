/**
 * Builds a shallow+deep merger of structured tool-call `arguments` JSON from a normalized BootstrapPackInput.
 */
export function mergeBootstrapToolArgumentsForPointers(normalizedBootstrap: Record<string, unknown>): Record<string, unknown> {
  const choices = normalizedBootstrap.openaiChatCompletion as
    | {
        choices?: Array<{
          message?: {
            tool_calls?: Array<{ function?: { arguments?: string } }>;
          };
        }>;
      }
    | undefined;
  const toolCalls = choices?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(toolCalls)) return {};

  let merged: Record<string, unknown> = {};
  for (const tc of toolCalls) {
    const raw = tc?.function?.arguments;
    if (typeof raw !== "string" || raw.length === 0) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      merged = deepMergeObjects(merged, parsed);
    } catch {
      /* skip malformed */
    }
  }
  return merged;
}

function deepMergeObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const existing = out[k];
    if (
      isPlainRecord(existing) &&
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = deepMergeObjects(existing, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isPlainRecord(u: unknown): u is Record<string, unknown> {
  return typeof u === "object" && u !== null && !Array.isArray(u);
}
