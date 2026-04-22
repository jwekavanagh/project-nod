import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  return path.join(__dirname, "..", "..");
}

function loadPrimaryMarketing(root: string) {
  return JSON.parse(readFileSync(path.join(root, "config", "primary-marketing.json"), "utf8")) as {
    heroTitle: string;
    readmeTitle: string;
    pageMetadata: { description: string };
    visitorProblemAnswer: string;
    identityOneLiner: string;
    site: { openGraph: { image: { alt: string; path: string } } };
  };
}

describe("rebrand requirements R1–R5", () => {
  it("R1 primary marketing + README acquisition fold + llms + identity", () => {
    const root = repoRoot();
    const pm = loadPrimaryMarketing(root);
    const idLine = pm.identityOneLiner;

    const llms = readFileSync(path.join(root, "llms.txt"), "utf8");
    const visitorFirst = pm.visitorProblemAnswer.split("\n\n")[0] ?? "";
    expect(llms).toContain(visitorFirst);
    expect(llms).toContain(idLine);

    const readme = readFileSync(path.join(root, "README.md"), "utf8");
    const foldStart = "<!-- discovery-acquisition-fold:start -->";
    const foldEnd = "<!-- discovery-acquisition-fold:end -->";
    const i = readme.indexOf(foldStart);
    const j = readme.indexOf(foldEnd);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    const fold = readme.slice(i + foldStart.length, j);
    expect(fold).toContain(pm.heroTitle);
  });

  it("R2 surface-ghost utility + hero terminal (dashed) in CSS; terminal appears on homepage", () => {
    const css = readFileSync(path.join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    expect(css).toContain(".surface-ghost {");
    expect(css).toContain("dashed");
    expect(css).toContain(".home-hero-terminal");
    const pageSrc = readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8");
    expect(pageSrc).toMatch(/home-hero-terminal/);
  });

  it("R3 layout uses Inter; cutover covered by rebrand-cutover for DM_Sans", () => {
    const layout = readFileSync(path.join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain('from "next/font/google"');
    expect(layout).toContain("Inter");
    expect(layout).toContain('variable: "--font-sans"');
  });

  it("BrandLockup source contains required markup", () => {
    const src = readFileSync(path.join(__dirname, "..", "src", "components", "BrandLockup.tsx"), "utf8");
    expect(src).toContain('data-testid="brand-lockup"');
    expect(src).toContain('aria-label="AgentSkeptic home"');
    expect(src).toContain("TRUST REALITY, NOT TRACES.");
    expect(src).toContain("brand-wordmark-agent");
    expect(src).toContain("brand-wordmark-skeptic");
    expect(src).toContain('import brandMark from "../../public/brand/mark.png"');
    expect(src).toContain("src={brandMark}");
    expect(src).toContain(">Agent</span>");
    expect(src).toContain(">Skeptic</span>");
  });

  it("R4 homepage hero shows verdict labels", () => {
    const pageSrc = readFileSync(path.join(__dirname, "..", "src", "app", "page.tsx"), "utf8");
    expect(pageSrc).toContain("VERDICT:");
    expect(pageSrc).toContain("FAILED");
  });

  it("R5 package description parity + OG alt + /og.png path", () => {
    const root = repoRoot();
    const pm = loadPrimaryMarketing(root);
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { description: string };
    expect(pkg.description).toBe(pm.pageMetadata.description);

    const metaPath = path.join(__dirname, "..", "src", "content", "siteMetadata.ts");
    const metaSrc = readFileSync(metaPath, "utf8");
    expect(metaSrc).toContain("primaryMarketing");
    expect(metaSrc).toContain("openGraphImage: primaryMarketing.site.openGraph.image");

    const layout = readFileSync(path.join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("siteMetadata.openGraphImage.path");
    expect(layout).toContain("siteMetadata.openGraphImage.alt");
    expect(pm.site.openGraph.image.path).toBe("/og.png");
  });
});
