import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertCoreDatabaseBoundary } from "@/lib/coreDatabaseBoundary";
import { ensureSslModeRequire } from "@/db/ensureSslModeRequire";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const preflight = path.join(root, "scripts", "core-database-boundary-preflight.mjs");

function runPreflight(extra: Record<string, string | undefined>): number {
  const r = spawnSync(process.execPath, [preflight], {
    env: { ...process.env, ...extra },
    encoding: "utf8",
  });
  return r.status === null ? 1 : r.status;
}

describe("core-database-boundary parity (TS assert vs preflight.mjs)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const poison =
    "postgresql://__agentskeptic_production_core__:5432/postgres?sslmode=require";

  it("both reject forbidden fingerprint when not production-like", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(() => assertCoreDatabaseBoundary(ensureSslModeRequire(poison))).toThrow();
    expect(
      runPreflight({
        VERCEL_ENV: "preview",
        DATABASE_URL: poison,
      }),
    ).toBe(1);
  });

  it("both allow localhost when not production-like", () => {
    expect(
      runPreflight({
        VERCEL_ENV: "preview",
        DATABASE_URL: "postgresql://127.0.0.1:5432/wfv",
      }),
    ).toBe(0);
  });
});
