import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT_BLOCK = `:root {
  --bg: #f6f8fc;
  --surface: #eef2f7;
  --surface-2: #e2e8f0;
  --fg: #0b1220;
  --muted: #5c6b7a;
  --brand-navy-ink: #0b1f33;
  --link: #1a4a6e;
  --link-hover: #0b1f33;
  --accent: #00c853;
  --accent-on-card: #007a3d;
  --accent-contrast: #ffffff;
  --danger: #b91c1c;
  --danger-bright: #d92d20;
  --danger-border: color-mix(in srgb, var(--danger) 55%, #1f0a0a);
  --card: #ffffff;
  --border: #d0d7e0;
  /* Populated by next/font variable on <html> (see layout.tsx). */
  --font-sans: ui-sans-serif, system-ui, sans-serif;
}`;

const PRELUDE_SELECTORS = [
  ".card",
  "button, .btn",
  "button.secondary, .btn.secondary",
  ".btn-pricing-secondary",
  ".link-secondary",
  ".link-secondary:hover",
  ".link-tertiary",
  ".site-header",
  ".site-footer",
  ".site-nav a",
  ".site-nav a:hover",
  ".site-nav button.site-nav-signout",
  ".site-nav-learn",
  ".code-block",
  ".truth-report-pre",
  ".integrate-prose h2",
  ".integrate-prose pre",
  ".integrate-prose th, .integrate-prose td",
  ".integrate-prose hr",
  ".try-it-select",
  ".home-hero",
  ".home-hero-positioning",
  ".home-hero-tertiary",
  ".try-it-verdict-card",
  ".try-it-k",
  ".home-hero-grid",
  ".home-hero-copy .home-cta-row",
  ".home-trust-strip",
  ".home-trust-strip-heading",
  ".home-trust-strip-list",
  ".home-hero-terminal-hit",
  ".home-moment-line",
  ".home-try-it",
  ".home-repeat-cta",
  ".home-what-catches-links-caption",
  ".home-what-catches",
  ".home-stakes-tension",
  ".home-how-tight",
  ".home-hero-verdict",
  ".home-hero-verdict-failed",
  ".home-stakes-tagline",
  ".home-closing",
  ".home-closing-links-caption",
  ".try-it-pre-frame",
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countPreludeBlocks(css: string, prelude: string): number {
  const re = new RegExp(`${escapeRegExp(prelude)}\\s*\\{`, "g");
  return (css.match(re) ?? []).length;
}

describe("globals.css buyer-surface contract", () => {
  const cssPath = path.join(__dirname, "..", "src", "app", "globals.css");
  const raw = readFileSync(cssPath, "utf8");
  const normalized = raw.replace(/\r\n/g, "\n");

  it("contains exact :root token block (§E)", () => {
    expect(normalized).toContain(ROOT_BLOCK);
  });

  it("uses shared surface tokens on key surfaces (pairings)", () => {
    expect(normalized).toContain("border: 1px solid var(--border)");
    expect(normalized).toContain("color: var(--fg)");
    expect(normalized).toContain("background: var(--surface-2)");
  });

  it("each listed selector prelude appears exactly once before a block (§CSS uniqueness)", () => {
    for (const prelude of PRELUDE_SELECTORS) {
      expect(countPreludeBlocks(normalized, prelude)).toBe(1);
    }
  });
});
