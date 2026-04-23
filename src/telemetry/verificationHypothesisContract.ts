/**
 * Canonical rules for optional `verification_hypothesis` on product-activation wire (schema_version 2).
 * @see docs/funnel-observability.md (field semantics; charset lives only here).
 */

export const VERIFICATION_HYPOTHESIS_MIN_LEN = 1;
export const VERIFICATION_HYPOTHESIS_MAX_LEN = 240;

/** ECMAScript String.prototype.trim semantics for the integrator string. */
export function normalizeVerificationHypothesisInput(raw: string): string {
  return raw.trim();
}

/**
 * True iff `trimmed` is non-empty, within length bounds, and every code unit is
 * U+0020–U+007E inclusive except U+0022 (") and U+0027 (').
 */
export function isValidVerificationHypothesisWireValue(trimmed: string): boolean {
  if (trimmed.length < VERIFICATION_HYPOTHESIS_MIN_LEN || trimmed.length > VERIFICATION_HYPOTHESIS_MAX_LEN) {
    return false;
  }
  for (let i = 0; i < trimmed.length; i++) {
    const cp = trimmed.charCodeAt(i);
    if (cp < 0x20 || cp > 0x7e) return false;
    if (cp === 0x22 || cp === 0x27) return false;
  }
  return true;
}

/**
 * Returns trimmed valid hypothesis for JSON, or `undefined` if env unset/blank/invalid (omit key on wire).
 */
export function verificationHypothesisForWireFromEnv(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = normalizeVerificationHypothesisInput(raw);
  if (t.length === 0) return undefined;
  return isValidVerificationHypothesisWireValue(t) ? t : undefined;
}
