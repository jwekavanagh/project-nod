import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function src(rel: string): string {
  return readFileSync(path.join(__dirname, "..", "src", ...rel.split("/")), "utf8");
}

describe("conversion spine contract", () => {
  it("declares governed routes and dominant CTA map in productCopy", () => {
    const s = src("content/productCopy.ts");
    expect(s).toContain("export const conversionSpine");
    expect(s).toContain('"/guides/[slug]"');
    expect(s).toContain('"/examples/[slug]"');
    expect(s).toContain('"/compare/[slug]"');
    expect(s).toContain('"/pricing": "Start free"');
    expect(s).toContain('"/claim": "Continue with email"');
  });

  it("keeps one primary CTA marker on core governed routes", () => {
    const files = [
      "app/page.tsx",
      "app/database-truth-vs-traces/page.tsx",
      "app/integrate/page.tsx",
      "app/guides/page.tsx",
      "app/problems/page.tsx",
      "app/compare/page.tsx",
      "app/security/page.tsx",
      "app/support/page.tsx",
      "app/contact/page.tsx",
      "app/privacy/page.tsx",
      "app/terms/page.tsx",
    ];
    for (const file of files) {
      const s = src(file);
      expect(s).toContain("data-cta-priority");
      expect(s.includes("ctaPriorityPrimaryValue") || s.includes('data-cta-priority="primary"')).toBe(true);
    }
  });

  it("removes header flyout indirection entirely", () => {
    const header = src("app/SiteHeader.tsx");
    const css = src("app/globals.css");
    const chrome = src("lib/siteChrome.ts");
    expect(header).not.toContain("site-nav-learn-flyout");
    expect(header).not.toContain("SITE_HEADER_LEARN_FLYOUT_LINKS");
    expect(css).not.toContain(".site-nav-learn-flyout");
    expect(chrome).not.toContain("SITE_HEADER_LEARN_FLYOUT_LINKS");
  });

  it("forces dynamic discovery routes to integrate as dominant CTA", () => {
    const surface = src("components/discovery/DiscoverySurfacePage.tsx");
    const progression = src("components/discovery/SurfaceProgression.tsx");
    expect(surface).toContain('<SurfaceProgression primaryCta="integrate" />');
    expect(progression).toContain('{ href: "/integrate", label: "Run first verification" }');
    expect(progression).toContain('data-cta-priority');
    expect(progression).toContain("ctaPriorityPrimaryValue");
  });
});

