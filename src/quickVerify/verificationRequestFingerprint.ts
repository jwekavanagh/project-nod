import { compareUtf16Id } from "../resolveExpectation.js";
import type { VerificationRequest } from "../types.js";
import { stableStringify } from "./canonicalJson.js";

/**
 * Stable fingerprint for `sql_row` requests (identity + required fields only), used for Quick pointer preflight.
 */
export function normalizedSqlRowRequestFingerprint(req: VerificationRequest): string {
  if (req.kind !== "sql_row") {
    throw new Error("normalizedSqlRowRequestFingerprint: expected sql_row");
  }
  const sortedPairs = [...req.identityEq].sort((a, b) => compareUtf16Id(a.column, b.column));
  const requiredKeys = Object.keys(req.requiredFields).sort(compareUtf16Id);
  const sortedRequired: Record<string, (typeof req.requiredFields)[string]> = {};
  for (const k of requiredKeys) {
    sortedRequired[k] = req.requiredFields[k]!;
  }
  return stableStringify({
    kind: "sql_row",
    table: req.table,
    identityEq: sortedPairs,
    requiredFields: sortedRequired,
  });
}
