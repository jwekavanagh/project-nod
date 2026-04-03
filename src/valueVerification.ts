import type { VerificationScalar } from "./types.js";

export function canonicalVerificationDisplayForExpected(v: VerificationScalar): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "NaN";
    if (v === Infinity) return "Infinity";
    if (v === -Infinity) return "-Infinity";
    return String(v);
  }
  return JSON.stringify(v);
}

export function canonicalVerificationDisplayForActual(actual: unknown): string {
  if (actual === null || actual === undefined) return "null";
  if (typeof actual === "boolean") return actual ? "true" : "false";
  if (typeof actual === "number") {
    if (Number.isNaN(actual)) return "NaN";
    if (actual === Infinity) return "Infinity";
    if (actual === -Infinity) return "-Infinity";
    return String(actual);
  }
  if (typeof actual === "string") return JSON.stringify(actual);
  if (typeof actual === "bigint") return JSON.stringify(actual.toString());
  if (actual instanceof Date && !Number.isNaN(actual.getTime())) {
    return JSON.stringify(actual.toISOString());
  }
  return JSON.stringify(String(actual));
}

export type VerificationCompareResult =
  | { ok: true }
  | { ok: false; expected: string; actual: string };

function fail(expected: VerificationScalar, actual: unknown): VerificationCompareResult {
  return {
    ok: false,
    expected: canonicalVerificationDisplayForExpected(expected),
    actual: canonicalVerificationDisplayForActual(actual),
  };
}

export function verificationScalarsEqual(
  expected: VerificationScalar,
  actual: unknown,
): VerificationCompareResult {
  if (expected === null) {
    if (actual === null || actual === undefined) return { ok: true };
    return fail(expected, actual);
  }

  if (actual === null || actual === undefined) {
    return fail(expected, actual);
  }

  if (typeof expected === "boolean") {
    const ok =
      (typeof actual === "boolean" && actual === expected) ||
      (typeof actual === "number" &&
        Number.isFinite(actual) &&
        ((expected === true && actual === 1) || (expected === false && actual === 0)));
    return ok ? { ok: true } : fail(expected, actual);
  }

  if (typeof expected === "number") {
    if (!Number.isFinite(expected)) {
      return fail(expected, actual);
    }

    if (typeof actual === "number" && Number.isFinite(actual) && actual === expected) {
      return { ok: true };
    }

    if (
      typeof actual === "bigint" &&
      Number.isInteger(expected) &&
      expected >= Number.MIN_SAFE_INTEGER &&
      expected <= Number.MAX_SAFE_INTEGER &&
      actual === BigInt(expected)
    ) {
      return { ok: true };
    }

    if (typeof actual === "string") {
      const t = actual.trim();
      try {
        const parsed = JSON.parse(t) as unknown;
        if (
          typeof parsed === "number" &&
          Number.isFinite(parsed) &&
          parsed === expected &&
          JSON.stringify(parsed) === JSON.stringify(expected)
        ) {
          return { ok: true };
        }
      } catch {
        /* no match */
      }
    }

    return fail(expected, actual);
  }

  if (typeof expected === "string") {
    const e = expected.trim();

    if (typeof actual === "string" && actual.trim() === e) {
      return { ok: true };
    }

    if (typeof actual === "number" && Number.isFinite(actual) && e === JSON.stringify(actual)) {
      return { ok: true };
    }

    if (typeof actual === "boolean" && e === JSON.stringify(actual)) {
      return { ok: true };
    }

    if (actual instanceof Date && !Number.isNaN(actual.getTime()) && e === actual.toISOString()) {
      return { ok: true };
    }

    return fail(expected, actual);
  }

  return fail(expected, actual);
}
