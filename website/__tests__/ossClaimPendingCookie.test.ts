import { describe, expect, it, vi } from "vitest";
import {
  buildClearCookiePendingHeader,
  OSS_PENDING_CLAIM_COOKIE_NAME,
  signPendingEnvelopeV1,
  verifyPendingEnvelopeV1,
} from "@/lib/ossClaimPendingCookie";

vi.mock("@/lib/authSecret", () => ({
  resolveAuthSecret: () => "a".repeat(64),
}));

describe("ossClaimPendingCookie", () => {
  const h = "a".repeat(64);
  const farFuture = new Date(Date.now() + 72 * 60 * 60 * 1000);

  it("round-trips sign and verify", () => {
    const signed = signPendingEnvelopeV1(h, farFuture);
    expect(signed).not.toBeNull();
    const parsed = verifyPendingEnvelopeV1(signed!.cookieValue);
    expect(parsed).toEqual(
      expect.objectContaining({
        v: 1,
        h,
        nbf: expect.any(Number) as number,
        exp: expect.any(Number) as number,
      }),
    );
  });

  it("rejects tampered signature", () => {
    const signed = signPendingEnvelopeV1(h, farFuture);
    expect(signed).not.toBeNull();
    const tampered = `${signed!.cookieValue.slice(0, -4)}abcd`;
    expect(verifyPendingEnvelopeV1(tampered)).toBeNull();
  });

  it("rejects expired envelope", () => {
    const signed = signPendingEnvelopeV1(h, farFuture);
    expect(signed).not.toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 2 * 60 * 60 * 1000));
    expect(verifyPendingEnvelopeV1(signed!.cookieValue)).toBeNull();
    vi.useRealTimers();
  });

  it("returns null when ticket expires too soon for envelope", () => {
    const soon = new Date(Date.now() + 30_000);
    expect(signPendingEnvelopeV1(h, soon)).toBeNull();
  });

  it("clear header uses fixed name and Max-Age=0", () => {
    const c = buildClearCookiePendingHeader();
    expect(c).toBe(
      `${OSS_PENDING_CLAIM_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  });
});
