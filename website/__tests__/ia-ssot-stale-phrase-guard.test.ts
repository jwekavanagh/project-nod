import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";

const STALE_IA_PHRASES = [
  "**Hub** `/guides` is **navigational**: `metadata.robots: { index: false, follow: true }`.",
  "**Hub pages** `/guides` and `/examples` are **noindex, follow** and are **not** listed alone in `sitemap.xml`",
] as const;

const FILE_ALLOWLIST = [
  "docs/discovery-guides.md",
  "docs/discovery-surfaces.md",
  "docs/public-distribution-ssot.md",
  "docs/website-product-experience.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "website/src/lib/siteChrome.ts",
  "website/src/app/sitemap.ts",
] as const;

describe("IA SSOT stale phrase guard", () => {
  it("allowlisted files must not contain retired hub-policy sentences", () => {
    const root = getRepoRoot();
    for (const rel of FILE_ALLOWLIST) {
      const abs = join(root, ...rel.split("/"));
      const body = readFileSync(abs, "utf8");
      for (const phrase of STALE_IA_PHRASES) {
        expect(body, `${rel} must not contain stale phrase`).not.toContain(phrase);
      }
    }
  });
});
