/** Obvious non-SELECT DML in quick-verify sources (read-only policy). */
export const QUICK_VERIFY_FORBIDDEN_SQL =
  /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+TABLE)\b/i;

export function quickVerifySourceViolatesSqlPolicy(source: string): boolean {
  return QUICK_VERIFY_FORBIDDEN_SQL.test(source);
}
