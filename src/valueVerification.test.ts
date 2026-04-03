import { describe, expect, it } from "vitest";
import {
  canonicalVerificationDisplayForActual,
  canonicalVerificationDisplayForExpected,
  verificationScalarsEqual,
} from "./valueVerification.js";

describe("canonicalVerificationDisplayForExpected", () => {
  it("null", () => {
    expect(canonicalVerificationDisplayForExpected(null)).toBe("null");
  });
  it("boolean", () => {
    expect(canonicalVerificationDisplayForExpected(true)).toBe("true");
    expect(canonicalVerificationDisplayForExpected(false)).toBe("false");
  });
  it("finite numbers", () => {
    expect(canonicalVerificationDisplayForExpected(42)).toBe("42");
    expect(canonicalVerificationDisplayForExpected(1.5)).toBe("1.5");
  });
  it("non-finite numbers", () => {
    expect(canonicalVerificationDisplayForExpected(Number.NaN)).toBe("NaN");
    expect(canonicalVerificationDisplayForExpected(Infinity)).toBe("Infinity");
    expect(canonicalVerificationDisplayForExpected(-Infinity)).toBe("-Infinity");
  });
  it("string uses JSON.stringify", () => {
    expect(canonicalVerificationDisplayForExpected("a")).toBe(JSON.stringify("a"));
    expect(canonicalVerificationDisplayForExpected('x"y')).toBe(JSON.stringify('x"y'));
  });
});

describe("canonicalVerificationDisplayForActual", () => {
  it("null and undefined", () => {
    expect(canonicalVerificationDisplayForActual(null)).toBe("null");
    expect(canonicalVerificationDisplayForActual(undefined)).toBe("null");
  });
  it("Date ISO quoted", () => {
    const d = new Date("2020-01-01T00:00:00.000Z");
    expect(canonicalVerificationDisplayForActual(d)).toBe(JSON.stringify("2020-01-01T00:00:00.000Z"));
  });
  it("bigint", () => {
    expect(canonicalVerificationDisplayForActual(9007199254740993n)).toBe(JSON.stringify("9007199254740993"));
  });
});

describe("verificationScalarsEqual", () => {
  it("rule 1: expected null matches null/undefined", () => {
    expect(verificationScalarsEqual(null, null)).toEqual({ ok: true });
    expect(verificationScalarsEqual(null, undefined)).toEqual({ ok: true });
  });

  it("expected null does not match value", () => {
    const r = verificationScalarsEqual(null, "x");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.expected).toBe("null");
      expect(r.actual).toBe(JSON.stringify("x"));
    }
  });

  it("rule 2: actual null with non-null expected", () => {
    const r = verificationScalarsEqual("a", null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.actual).toBe("null");
    }
  });

  it("rule 3: boolean and 0/1", () => {
    expect(verificationScalarsEqual(true, true)).toEqual({ ok: true });
    expect(verificationScalarsEqual(false, false)).toEqual({ ok: true });
    expect(verificationScalarsEqual(true, 1)).toEqual({ ok: true });
    expect(verificationScalarsEqual(false, 0)).toEqual({ ok: true });
    expect(verificationScalarsEqual(true, false).ok).toBe(false);
    expect(verificationScalarsEqual(false, 1).ok).toBe(false);
  });

  it("rule 4a: number === number", () => {
    expect(verificationScalarsEqual(42, 42)).toEqual({ ok: true });
    expect(verificationScalarsEqual(1.5, 1.5)).toEqual({ ok: true });
  });

  it("rule 4b: bigint", () => {
    expect(verificationScalarsEqual(42, 42n)).toEqual({ ok: true });
    expect(verificationScalarsEqual(42, 43n).ok).toBe(false);
  });

  it("rule 4c: string JSON number", () => {
    expect(verificationScalarsEqual(42, " 42 ")).toEqual({ ok: true });
    expect(verificationScalarsEqual(42, "42.0")).toEqual({ ok: true });
    expect(verificationScalarsEqual(42, "042").ok).toBe(false);
  });

  it("rule 5a: string trim", () => {
    expect(verificationScalarsEqual("  a  ", "a")).toEqual({ ok: true });
    expect(verificationScalarsEqual("a", "  a  ")).toEqual({ ok: true });
  });

  it("rule 5b: string expected vs number actual", () => {
    expect(verificationScalarsEqual("42", 42)).toEqual({ ok: true });
    expect(verificationScalarsEqual("1.5", 1.5)).toEqual({ ok: true });
    expect(verificationScalarsEqual("41", 42).ok).toBe(false);
  });

  it("rule 5c: string expected vs boolean actual", () => {
    expect(verificationScalarsEqual("true", true)).toEqual({ ok: true });
    expect(verificationScalarsEqual("false", false)).toEqual({ ok: true });
  });

  it("rule 5d: string expected vs Date ISO", () => {
    const d = new Date("2020-01-01T00:00:00.000Z");
    expect(verificationScalarsEqual("2020-01-01T00:00:00.000Z", d)).toEqual({ ok: true });
  });

  it("non-finite expected number never matches", () => {
    expect(verificationScalarsEqual(Number.NaN, Number.NaN).ok).toBe(false);
  });

  it("determinism: identical results on repeat", () => {
    const args = [null, "x"] as const;
    const a = verificationScalarsEqual(args[0], args[1]);
    const b = verificationScalarsEqual(args[0], args[1]);
    expect(a).toEqual(b);

    const ok = verificationScalarsEqual(1, 1);
    const ok2 = verificationScalarsEqual(1, 1);
    expect(ok).toEqual(ok2);

    const fail = verificationScalarsEqual(1, 2);
    const fail2 = verificationScalarsEqual(1, 2);
    expect(fail).toEqual(fail2);
  });
});
