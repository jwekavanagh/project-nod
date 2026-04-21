import sitemap from "@/app/sitemap";
import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { listAllSurfaces, listDiscoveryRoutes } from "@/lib/surfaceMarkdown";
import { describe, expect, it } from "vitest";

describe("sitemap", () => {
  it("includes every markdown discovery route, /guides and /compare hubs, /security; omits /examples hub", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    const base = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
    for (const route of listDiscoveryRoutes()) {
      expect(urls.some((u) => u === `${base}${route}`)).toBe(true);
    }
    expect(urls.some((u) => u.endsWith("/security"))).toBe(true);
    expect(urls).toContain(`${base}/guides`);
    expect(urls).toContain(`${base}/compare`);
    expect(urls).not.toContain(`${base}/examples`);

    const idx = (suffix: string) => urls.findIndex((u) => u === `${base}${suffix}`);
    const iIntegrate = idx("/integrate");
    const iGuides = idx("/guides");
    const iProblems = idx("/problems");
    const iSupport = idx("/support");
    expect(iIntegrate).toBeGreaterThanOrEqual(0);
    expect(iGuides).toBeGreaterThanOrEqual(0);
    expect(iProblems).toBeGreaterThanOrEqual(0);
    expect(iSupport).toBeGreaterThanOrEqual(0);
    expect(iGuides).toBeGreaterThan(iIntegrate);
    expect(iProblems).toBeGreaterThan(iGuides);
    expect(iSupport).toBeGreaterThan(iProblems);
  });

  it("includes acquisition slug from discovery SSOT", async () => {
    const entries = await sitemap();
    const base = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
    expect(entries.some((e) => e.url === `${base}${discoveryAcquisition.slug}`)).toBe(true);
  });

  it("lists discovery surfaces in route order under markdown corpus", () => {
    const routes = listAllSurfaces().map((s) => s.route);
    const sorted = [...routes].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    expect(routes).toEqual(sorted);
  });
});
