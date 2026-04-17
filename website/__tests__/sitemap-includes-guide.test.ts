import sitemap from "@/app/sitemap";
import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { describe, expect, it } from "vitest";

describe("sitemap", () => {
  it("includes every indexable guide and example path, /guides hub in pinned order, /security; omits /examples hub", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const base = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
    for (const g of discoveryAcquisition.indexableGuides) {
      expect(urls.some((u) => u === `${base}${g.path}`)).toBe(true);
    }
    for (const e of discoveryAcquisition.indexableExamples) {
      expect(urls.some((u) => u === `${base}${e.path}`)).toBe(true);
    }
    expect(urls.some((u) => u.endsWith("/security"))).toBe(true);
    expect(urls).toContain(`${base}/guides`);
    expect(urls).not.toContain(`${base}/examples`);

    const idx = (suffix: string) => urls.findIndex((u) => u === `${base}${suffix}`);
    const iIntegrate = idx("/integrate");
    const iGuides = idx("/guides");
    const iSupport = idx("/support");
    expect(iIntegrate).toBeGreaterThanOrEqual(0);
    expect(iGuides).toBeGreaterThanOrEqual(0);
    expect(iSupport).toBeGreaterThanOrEqual(0);
    expect(iGuides).toBeGreaterThan(iIntegrate);
    expect(iSupport).toBeGreaterThan(iGuides);
  });
});
