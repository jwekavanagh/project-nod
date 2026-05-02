import { formatOperationalMessage, OPERATIONAL_MESSAGE_MAX_CHARS } from "./failureCatalog.js";

const STRIP_PATTERNS: RegExp[] = [
  /\bsk_(live|test)_[a-zA-Z0-9]{8,}\b/gi,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[a-zA-Z0-9._\-+/=]{20,}\b/gi,
];

/**
 * Sanitize user-facing evidence strings: operational cap + obvious secret token shapes.
 */
export function redactEvidenceString(raw: string, maxLen: number = OPERATIONAL_MESSAGE_MAX_CHARS): string {
  let s = raw.replace(/\r\n|\r|\n/g, " ");
  for (const re of STRIP_PATTERNS) {
    s = s.replace(re, "[redacted]");
  }
  return formatOperationalMessage(s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s);
}
