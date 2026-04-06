/**
 * v9-only: `runLevelCodes[i]` must equal `runLevelReasons[i].code` (compare ingress + legacy corpus).
 */

export function isV9RunLevelCodesInconsistent(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (o.schemaVersion !== 9) return false;
  const rc = o.runLevelCodes;
  const rr = o.runLevelReasons;
  if (!Array.isArray(rc) || !Array.isArray(rr)) return true;
  if (rc.length !== rr.length) return true;
  for (let i = 0; i < rc.length; i++) {
    if (typeof rc[i] !== "string") return true;
    const item = rr[i];
    if (typeof item !== "object" || item === null) return true;
    const code = (item as { code?: unknown }).code;
    if (typeof code !== "string") return true;
    if (rc[i] !== code) return true;
  }
  return false;
}
