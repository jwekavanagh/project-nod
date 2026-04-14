/**
 * Map flattened parameter keys (see `flattenParams`) to RFC 6901 JSON Pointers
 * relative to the root object that `JSON.parse(JSON.stringify(params))` would produce.
 */
export type FlatKeyToPointerResult =
  | { ok: true; pointer: string }
  | { ok: false; code: "EMPTY_KEY" | "INVALID_SYNTAX" | "INVALID_ARRAY_INDEX" | "EMPTY_SEGMENT" };

function encodePointerToken(tok: string): string {
  return tok.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Parse `flattenParams` keys into `/seg/seg/...` pointers. Supports `.` object nesting and `[n]` arrays.
 */
export function flatKeyToJsonPointer(flatKey: string): FlatKeyToPointerResult {
  if (flatKey.length === 0) return { ok: false, code: "EMPTY_KEY" };
  const parts: string[] = [];
  let i = 0;
  const s = flatKey;
  while (i < s.length) {
    if (s[i] === ".") return { ok: false, code: "INVALID_SYNTAX" };
    if (s[i] === "[") {
      const close = s.indexOf("]", i);
      if (close < 0) return { ok: false, code: "INVALID_SYNTAX" };
      const inner = s.slice(i + 1, close);
      if (!/^\d+$/.test(inner)) return { ok: false, code: "INVALID_ARRAY_INDEX" };
      parts.push(inner);
      i = close + 1;
      if (i < s.length && s[i] === ".") i++;
      continue;
    }
    let j = i;
    while (j < s.length && s[j] !== "." && s[j] !== "[") j++;
    const seg = s.slice(i, j);
    if (seg.length === 0) return { ok: false, code: "EMPTY_SEGMENT" };
    parts.push(encodePointerToken(seg));
    i = j;
    if (i < s.length && s[i] === ".") i++;
  }
  if (parts.length === 0) return { ok: false, code: "EMPTY_KEY" };
  return { ok: true, pointer: `/${parts.join("/")}` };
}
