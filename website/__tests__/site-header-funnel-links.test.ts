import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("SiteHeader funnel links", () => {
  const src = readFileSync(path.join(__dirname, "..", "src", "app", "SiteHeader.tsx"), "utf8");
  const siteChromeSrc = readFileSync(path.join(__dirname, "..", "src", "lib", "siteChrome.ts"), "utf8");

  it("exposes acquisition, learn, problems, compare, pricing, and CLI links", () => {
    expect(src).toContain("buildSiteHeaderPrimaryLinks");
    expect(src).toContain('href="/guides"');
    expect(src).toContain('href="/problems"');
    expect(src).toContain('href="/compare"');
    expect(src).not.toContain("site-nav-learn-flyout");
    expect(src).not.toContain("site-nav-learn-primary");
    expect(siteChromeSrc).not.toContain("SITE_HEADER_LEARN_FLYOUT_LINKS");
    expect(siteChromeSrc).toContain('label: "Run first verification"');
    expect(src).toContain("href={productCopy.homepageAcquisitionCta.href}");
    expect(src).toContain("{marketing.homepageAcquisitionCtaLabel}");
    expect(siteChromeSrc).toContain('href: "/integrate"');
    expect(siteChromeSrc).toContain('href: "/pricing"');
    expect(src).toContain('href="/auth/signin?callbackUrl=%2Faccount"');
    expect(src).toContain('href="/account"');
    expect(src).toContain("SignOutButton");
    expect(siteChromeSrc).toContain('href: `${anchors.gitRepositoryUrl}#try-it-about-one-minute`');
  });
});
