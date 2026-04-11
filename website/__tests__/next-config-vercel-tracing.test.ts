import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("next.config outputFileTracingRoot", () => {
  const keys = ["VERCEL", "NEXT_CONFIG_TRACE_ROOT"] as const;
  const saved: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const k of keys) saved[k] = process.env[k];
    delete process.env.VERCEL;
    delete process.env.NEXT_CONFIG_TRACE_ROOT;
  });

  afterEach(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("sets outputFileTracingRoot when VERCEL=1", async () => {
    process.env.VERCEL = "1";
    const mod = await import("../next.config");
    const cfg = mod.default as { outputFileTracingRoot?: string };
    expect(cfg.outputFileTracingRoot).toMatch(/workflow-verifier$/);
  });

  it("omits outputFileTracingRoot when VERCEL unset and NEXT_CONFIG_TRACE_ROOT unset", async () => {
    vi.resetModules();
    const mod = await import("../next.config");
    const cfg = mod.default as { outputFileTracingRoot?: string };
    expect(cfg.outputFileTracingRoot).toBeUndefined();
  });
});
