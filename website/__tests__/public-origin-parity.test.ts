import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { loadAnchors } from "./helpers/distributionGraphHelpers";

const require = createRequire(import.meta.url);
const { assertNextPublicOriginParity, normalize } = require("../../scripts/public-product-anchors.cjs") as {
  assertNextPublicOriginParity: () => void;
  normalize: (s: string) => string;
};

describe("public origin parity (assertNextPublicOriginParity)", () => {
  const keys = ["NODE_ENV", "VERCEL_ENV", "NEXT_PUBLIC_APP_URL"] as const;
  const snapshot: Partial<Record<(typeof keys)[number], string | undefined>> = {};

  afterEach(() => {
    for (const k of keys) {
      const v = snapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  function stashEnv() {
    for (const k of keys) snapshot[k] = process.env[k];
  }

  it("row: next dev — NODE_ENV development skips parity even when URL mismatches", () => {
    stashEnv();
    const canonical = normalize(loadAnchors().productionCanonicalOrigin);
    process.env.NODE_ENV = "development";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://wrong-origin.example";
    expect(() => assertNextPublicOriginParity()).not.toThrow();
    expect(normalize(process.env.NEXT_PUBLIC_APP_URL)).not.toBe(canonical);
  });

  it("row: Vercel preview — production NODE_ENV with VERCEL_ENV preview skips parity", () => {
    stashEnv();
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_APP_URL = "https://wrong-origin.example";
    expect(() => assertNextPublicOriginParity()).not.toThrow();
  });

  it("row: Vercel production — enforces parity when URL matches canonical", () => {
    stashEnv();
    const anchors = loadAnchors();
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = normalize(anchors.productionCanonicalOrigin);
    expect(() => assertNextPublicOriginParity()).not.toThrow();
  });

  it("row: Vercel production — throws when URL does not match canonical", () => {
    stashEnv();
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://wrong-origin.example";
    expect(() => assertNextPublicOriginParity()).toThrow(/NEXT_PUBLIC_APP_URL must equal productionCanonicalOrigin/);
  });

  it("row: local next build — VERCEL_ENV unset enforces parity when URL matches", () => {
    stashEnv();
    const anchors = loadAnchors();
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_APP_URL = normalize(anchors.productionCanonicalOrigin);
    expect(() => assertNextPublicOriginParity()).not.toThrow();
  });

  it("row: local next build — VERCEL_ENV unset and NEXT_PUBLIC_APP_URL empty — skips parity", () => {
    stashEnv();
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(() => assertNextPublicOriginParity()).not.toThrow();
  });

  it("row: local next build — VERCEL_ENV unset throws when URL mismatches", () => {
    stashEnv();
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_APP_URL = "https://wrong-origin.example";
    expect(() => assertNextPublicOriginParity()).toThrow(/NEXT_PUBLIC_APP_URL must equal productionCanonicalOrigin/);
  });
});
