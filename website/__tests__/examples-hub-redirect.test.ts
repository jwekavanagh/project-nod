import { loadAnchors } from "./helpers/distributionGraphHelpers";
import {
  ensureMarketingSiteRunning,
  registerMarketingSiteTeardown,
} from "./helpers/siteTestServer";
import { createRequire } from "node:module";
import { describe, expect, beforeAll, it } from "vitest";

const require = createRequire(import.meta.url);
const { normalize } = require("../../scripts/public-product-anchors.cjs") as {
  normalize: (s: string) => string;
};

registerMarketingSiteTeardown();

describe("examples hub redirect", { timeout: 300_000 }, () => {
  beforeAll(async () => {
    const anchors0 = loadAnchors();
    process.env.NEXT_PUBLIC_APP_URL = normalize(anchors0.productionCanonicalOrigin);
    process.env.VERCEL_ENV = "production";
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error("examples-hub-redirect: DATABASE_URL required");
    }
    await ensureMarketingSiteRunning();
  });

  it("GET /examples returns 308 to /guides with Location pathname /guides", async () => {
    const res = await fetch("http://127.0.0.1:34100/examples", { redirect: "manual" });
    expect(res.status).toBe(308);
    const loc = res.headers.get("location");
    expect(loc).toBeTruthy();
    const canonicalOrigin = normalize(loadAnchors().productionCanonicalOrigin);
    const u = new URL(loc!, canonicalOrigin);
    expect(u.pathname).toBe("/guides");
    expect(u.hash).toBe("");
  });

  it("GET /examples/wf-complete returns 200 (not hub redirect)", async () => {
    const res = await fetch("http://127.0.0.1:34100/examples/wf-complete", { redirect: "manual" });
    expect(res.status).toBe(200);
  });
});
