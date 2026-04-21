import { describe, expect, it } from "vitest";
import { siteMetadata } from "@/content/siteMetadata";
import { capJsonLdDescription, discoveryArticleJsonLdGraph } from "@/lib/discoveryArticleJsonLd";

describe("discoveryArticleJsonLd", () => {
  it("caps descriptions for JSON-LD", () => {
    const long = `${"word ".repeat(200)}end`;
    const capped = capJsonLdDescription(long);
    expect(capped.length).toBeLessThanOrEqual(321);
  });

  it("graph includes TechArticle and BreadcrumbList", () => {
    const g = discoveryArticleJsonLdGraph({
      headline: "H",
      description: "D".repeat(10),
      path: "/problems",
    });
    const graph = g["@graph"] as { "@type": string }[];
    expect(graph).toHaveLength(2);
    expect(graph.map((x) => x["@type"])).toEqual(["TechArticle", "BreadcrumbList"]);
  });
});

describe("siteMetadata.integrate.description cap", () => {
  it("is at most 320 characters", () => {
    expect(siteMetadata.integrate.description.length).toBeLessThanOrEqual(320);
  });
});
