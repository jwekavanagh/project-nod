import type { VerificationScalar } from "../types.js";
import { stableStringify } from "./canonicalJson.js";

/**
 * Merge cloned tool `action.params` with Quick `__qvFields` for synthetic NDJSON / resolver preflight (M1–M5).
 */
export function buildSyntheticRowParams(
  actionParams: Record<string, unknown>,
  qvFields: Record<string, VerificationScalar>,
): Record<string, unknown> {
  const base = JSON.parse(JSON.stringify(actionParams)) as Record<string, unknown>;
  base["__qvFields"] = qvFields;
  return base;
}

export function stableStringifySyntheticParams(params: Record<string, unknown>): string {
  return stableStringify(params);
}
