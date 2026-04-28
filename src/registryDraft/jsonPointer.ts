/** Minimal RFC 6901 pointer resolution for draft verification pointerStress (integrator payloads). */

function decodeJsonPointerSegment(seg: string): string {
  return seg.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Resolve a JSON Pointer against `doc`.
 * Supports `/a/b`; returns `undefined` if path missing.
 */
export function resolveJsonPointer(doc: unknown, pointer: string): unknown {
  if (pointer === "") return doc;
  if (!pointer.startsWith("/")) return undefined;
  const parts = pointer.slice(1).split("/").map(decodeJsonPointerSegment);
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      const i = Number(p);
      if (!Number.isFinite(i) || i < 0 || i >= cur.length) return undefined;
      cur = cur[i];
    } else if (Object.prototype.hasOwnProperty.call(cur, p)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function collectPointerStringsFromDraftTools(toolsArrayOrNested: unknown): string[] {
  const out = new Set<string>();
  function walk(node: unknown): void {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const o = node as Record<string, unknown>;
    if (typeof o.pointer === "string") {
      const s = o.pointer;
      if (s.startsWith("/")) out.add(s);
    }
    for (const v of Object.values(o)) {
      walk(v);
    }
  }
  walk(toolsArrayOrNested);
  return [...out.values()];
}
