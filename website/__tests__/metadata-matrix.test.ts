import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { metadata as problemsMetadata } from "@/app/problems/page";
import { metadata as compareHubMetadata } from "@/app/compare/page";
import { generateMetadata as generateCompareSlugMetadata } from "@/app/compare/[slug]/page";
import { metadata as acquisitionMetadata } from "@/app/database-truth-vs-traces/page";
import { generateMetadata as generateExampleSlugMetadata } from "@/app/examples/[slug]/page";
import { metadata as guidesHubMetadata } from "@/app/guides/page";
import { generateMetadata as generateGuideSlugMetadata } from "@/app/guides/[slug]/page";
import { metadata as integrateMetadata } from "@/app/integrate/page";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as pricingMetadata } from "@/app/pricing/page";
import { metadata as privacyMetadata } from "@/app/privacy/page";
import { metadata as securityMetadata } from "@/app/security/page";
import { metadata as supportMetadata } from "@/app/support/page";
import { metadata as termsMetadata } from "@/app/terms/page";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { listAllSurfaces } from "@/lib/surfaceMarkdown";

function metadataTitle(m: Metadata): string {
  const t = m.title;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && "default" in t) return String((t as { default: string }).default);
  return String(t ?? "");
}

function metadataDescription(m: Metadata): string {
  const d = m.description;
  return typeof d === "string" ? d : String(d ?? "");
}

describe("metadata matrix (merge gate)", () => {
  it("root layout source does not set global canonical or site openGraph.url", () => {
    const layoutSrc = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
    expect(layoutSrc).not.toContain("alternates:");
    expect(layoutSrc).not.toContain("openGraph.url");
  });

  it("every indexable marketing route has distinct title, description, and correct canonical", async () => {
    type Row = { route: string; title: string; description: string; canonical: string };
    const rows: Row[] = [];

    const add = (route: string, m: Metadata) => {
      rows.push({
        route,
        title: metadataTitle(m),
        description: metadataDescription(m),
        canonical: String(m.alternates?.canonical ?? ""),
      });
    };

    add("/", homeMetadata);
    add("/pricing", pricingMetadata);
    add("/privacy", privacyMetadata);
    add("/terms", termsMetadata);
    add("/integrate", integrateMetadata);
    add("/database-truth-vs-traces", acquisitionMetadata);
    add("/guides", guidesHubMetadata);
    add("/compare", compareHubMetadata);
    add("/security", securityMetadata);
    add("/support", supportMetadata);
    add("/problems", problemsMetadata);

    for (const s of listAllSurfaces()) {
      let m: Metadata;
      if (s.segment === "guides") {
        m = await generateGuideSlugMetadata({ params: Promise.resolve({ slug: s.slug }) });
      } else if (s.segment === "examples") {
        m = await generateExampleSlugMetadata({ params: Promise.resolve({ slug: s.slug }) });
      } else {
        m = await generateCompareSlugMetadata({ params: Promise.resolve({ slug: s.slug }) });
      }
      add(s.route, m);
    }

    const titles = rows.map((r) => r.title);
    const descriptions = rows.map((r) => r.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);

    for (const r of rows) {
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect(r.canonical).toBe(indexableGuideCanonical(r.route));
    }
  });
});
