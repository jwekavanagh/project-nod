"use strict";

/**
 * Reference string redaction rules (doc-equivalence for operators using jq).
 * Not used by the Next.js runtime.
 *
 * @param {string} s
 */
function redactString(s) {
  let t = String(s);
  t = t.replace(/Bearer\s+\S+/gi, "[REDACTED_BEARER]");
  t = t.replace(/sk-[a-zA-Z0-9]{20,}/gi, "[REDACTED_SK]");
  t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]");
  if (t.length > 240) {
    return `[REDACTED_LONG_STRING_LEN_${t.length}]`;
  }
  return t;
}

/**
 * @param {unknown} value
 */
function applyRedactionWalk(value) {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map(applyRedactionWalk);
  }
  if (value !== null && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = applyRedactionWalk(/** @type {Record<string, unknown>} */ (value)[k]);
    }
    return out;
  }
  return value;
}

module.exports = { applyRedactionWalk, redactString };
