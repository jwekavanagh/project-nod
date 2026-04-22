import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HERO_TITLE = "Your trace says success. Your database is the verdict.";
const README_TITLE = "AgentSkeptic — trust database rows, not trace color";
const PAGE_METADATA_DESCRIPTION =
  "Traces and success flags are not proof: read-only SQL at verification time checks persisted database rows against structured tool activity—VERIFIED or inconsistent with reason codes, not log search.";
const OG_ALT =
  "AgentSkeptic — trust reality, not traces; read-only SQL verifies persisted database rows";

function repoRoot(): string {
  return path.join(__dirname, "..", "..");
}

describe("rebrand requirements R1–R5", () => {
  it("R1 discovery + README acquisition fold + llms + anchors identity", () => {
    const root = repoRoot();
    const disc = JSON.parse(readFileSync(path.join(root, "config", "discovery-acquisition.json"), "utf8")) as {
      heroTitle: string;
      readmeTitle: string;
      pageMetadata: { description: string };
      visitorProblemAnswer: string;
    };
    expect(disc.heroTitle).toBe(HERO_TITLE);
    expect(disc.readmeTitle).toBe(README_TITLE);
    expect(disc.pageMetadata.description).toBe(PAGE_METADATA_DESCRIPTION);

    const anchors = JSON.parse(readFileSync(path.join(root, "config", "public-product-anchors.json"), "utf8")) as {
      identityOneLiner: string;
    };
    const idLine = anchors.identityOneLiner;

    const llms = readFileSync(path.join(root, "llms.txt"), "utf8");
    const visitorFirst = disc.visitorProblemAnswer.split("\n\n")[0] ?? "";
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
    expect(fold).toContain(HERO_TITLE);
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
    expect(src).toContain('src="/brand/mark.png"');
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
    const disc = JSON.parse(readFileSync(path.join(root, "config", "discovery-acquisition.json"), "utf8")) as {
      pageMetadata: { description: string };
    };
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { description: string };
    expect(pkg.description).toBe(disc.pageMetadata.description);

    const metaPath = path.join(__dirname, "..", "src", "content", "siteMetadata.ts");
    const metaSrc = readFileSync(metaPath, "utf8");
    expect(metaSrc).toContain(OG_ALT);

    const layout = readFileSync(path.join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("siteMetadata.openGraphImage.path");
    const siteMeta = readFileSync(metaPath, "utf8");
    expect(siteMeta).toContain('path: "/og.png"');
  });
});
