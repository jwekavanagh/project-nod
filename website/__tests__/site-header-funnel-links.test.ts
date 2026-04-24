import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SiteHeader funnel links", () => {
  const src = readFileSync(path.join(__dirname, "..", "src", "app", "SiteHeader.tsx"), "utf8");
  const siteChromeSrc = readFileSync(path.join(__dirname, "..", "src", "lib", "siteChrome.ts"), "utf8");

  it("exposes Learn to /guides, flyout, acquisition, Get started, pricing, sign-in callback, account, sign-out, and CLI", () => {
    expect(src).toContain("buildSiteHeaderPrimaryLinks");
    expect(src).toContain("SITE_HEADER_LEARN_FLYOUT_LINKS");
    expect(src).toContain('href="/guides"');
    expect(src).toContain("site-nav-learn-flyout");
    expect(src).toContain("site-nav-learn-primary");
    expect(siteChromeSrc).toContain('href: "/problems"');
    expect(siteChromeSrc).toContain('label: "Problems"');
    expect(siteChromeSrc).toContain('href: "/compare"');
    expect(siteChromeSrc).toContain('label: "Compare"');
    expect(siteChromeSrc).not.toContain('label: "Guides"');
    expect(siteChromeSrc).toContain('label: "Get started"');
    expect(src).toContain("href={productCopy.homepageAcquisitionCta.href}");
    expect(src).toContain("{marketing.homepageAcquisitionCtaLabel}");
    expect(siteChromeSrc).toContain('href: "/integrate"');
    expect(siteChromeSrc).toContain('href: "/pricing"');
    expect(src).toContain('href="/auth/signin?callbackUrl=%2Faccount"');
    expect(src).toContain('href="/account"');
    expect(src).toContain("SignOutButton");
    expect(src).toContain("href={cliQuickstartHref}");
  });
});
