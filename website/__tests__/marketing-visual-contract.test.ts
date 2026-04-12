import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { productCopy } from "@/content/productCopy";

describe("marketing visual contract", () => {
  it("globals.css wires heading font to --font-heading", () => {
    const css = readFileSync(path.join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    expect(css).toContain("--font-heading:");
    expect(css).toMatch(/h1\s*,/);
    expect(css).toContain("font-family: var(--font-heading)");
  });

  it("layout.tsx applies next/font/google with --font-heading variable on html", () => {
    const layout = readFileSync(path.join(__dirname, "..", "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain('from "next/font/google"');
    expect(layout).toContain('variable: "--font-heading"');
    expect(layout).toMatch(/<html\s+lang="en"\s+className=\{\s*headingFont\.variable\s*\}/);
  });
});

describe("securityTrust copy", () => {
  it("does not claim common certifications without evidence", () => {
    const blobs: string[] = [productCopy.securityTrust.intro];
    for (const s of productCopy.securityTrust.sections) {
      blobs.push(s.heading, ...s.paragraphs);
    }
    const joined = blobs.join(" ").toLowerCase();
    expect(joined).not.toContain("soc 2");
    expect(joined).not.toContain("hipaa");
    expect(joined).not.toContain("iso 27001");
  });
});
