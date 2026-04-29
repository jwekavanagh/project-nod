/**
 * Detects Postgres **42P01 undefined_table** for `api_key_v2` (migration `0016_api_key_v2.sql` not applied).
 * Drizzle may wrap the driver error; `code` may live on `error.cause`.
 */
function deepPostgresCode(error: unknown): string | undefined {
  let cur: unknown = error;
  const seen = new Set<unknown>();
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const code = (cur as { code?: string }).code;
    if (typeof code === "string" && code.length > 0) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export function isMissingApiKeyV2Relation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/relation "api_key_v2" does not exist/i.test(message)) {
    return true;
  }
  const code = deepPostgresCode(error);
  return code === "42P01" && /api_key_v2/i.test(message);
}
