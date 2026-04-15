import {
  CORE_DATABASE_BOUNDARY_VIOLATION,
  assertCoreDatabaseBoundary,
  computeCoreDatabaseFingerprint,
  normalizeDatabaseUrlForFingerprint,
} from "@/lib/coreDatabaseBoundary";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("coreDatabaseBoundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes URL for fingerprint (sorted query, lower host, default port)", () => {
    const u =
      "postgresql://USER:PASS@Example.com/mydb?z=2&a=1&sslmode=require";
    expect(normalizeDatabaseUrlForFingerprint(u)).toBe(
      "postgresql://example.com:5432/mydb?a=1&sslmode=require&z=2",
    );
  });

  it("computes stable fingerprint for golden vector", () => {
    const fp = computeCoreDatabaseFingerprint(
      "postgresql://__agentskeptic_production_core__:5432/postgres?sslmode=require",
    );
    expect(fp).toBe("008ee672fbb5522acf49f105b8700102afed2aa945c339b8c093146483c77d47");
  });

  it("throws when non-production-like and URL matches forbidden fingerprint", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const poison =
      "postgresql://__agentskeptic_production_core__:5432/postgres?sslmode=require";
    expect(() => assertCoreDatabaseBoundary(poison)).toThrow(CORE_DATABASE_BOUNDARY_VIOLATION);
  });

  it("skips when production-like even if URL matches forbidden fingerprint", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const poison =
      "postgresql://__agentskeptic_production_core__:5432/postgres?sslmode=require";
    expect(() => assertCoreDatabaseBoundary(poison)).not.toThrow();
  });

  it("skips placeholder build DSN", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() =>
      assertCoreDatabaseBoundary(
        "postgresql://127.0.0.1:5432/workflow_verifier_build_placeholder",
      ),
    ).not.toThrow();
  });
});
