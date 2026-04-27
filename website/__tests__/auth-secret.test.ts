import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAuthSecret } from "@/lib/authSecret";

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe("resolveAuthSecret", () => {
  it("returns configured AUTH_SECRET when valid", () => {
    process.env.AUTH_SECRET = "a".repeat(32);
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "production";
    expect(resolveAuthSecret()).toBe("a".repeat(32));
  });

  it("uses preview fallback when AUTH_SECRET is unset in Vercel preview", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    process.env.VERCEL_ENV = "preview";
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const value = resolveAuthSecret();
    expect(value.length).toBeGreaterThanOrEqual(32);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("throws in production when AUTH_SECRET is unset and not preview", () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "production";
    expect(() => resolveAuthSecret()).toThrow(/AUTH_SECRET is required/);
  });
});
