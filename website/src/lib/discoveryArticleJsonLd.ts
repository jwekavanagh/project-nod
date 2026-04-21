import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { publicProductAnchors } from "@/lib/publicProductAnchors";

const DEFAULT_MAX = 320;

export function capJsonLdDescription(raw: string, maxLen: number = DEFAULT_MAX): string {
  const t = raw.trim();
  if (t.length <= maxLen) return t;
  const slice = t.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…";
}

export function discoveryArticleJsonLdGraph(args: {
  headline: string;
  description: string;
  path: string;
  breadcrumbMiddle?: { name: string; path: string };
}): Record<string, unknown> {
  const origin = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
  const url = indexableGuideCanonical(args.path);
  const description = capJsonLdDescription(args.description);
  const homeItem = `${origin}/`;
  const crumbs: Array<{ "@type": string; position: number; name: string; item: string }> = [
    { "@type": "ListItem", position: 1, name: "Home", item: homeItem },
  ];
  let pos = 2;
  if (args.breadcrumbMiddle) {
    crumbs.push({
      "@type": "ListItem",
      position: pos++,
      name: args.breadcrumbMiddle.name,
      item: indexableGuideCanonical(args.breadcrumbMiddle.path),
    });
  }
  crumbs.push({
    "@type": "ListItem",
    position: pos,
    name: args.headline,
    item: url,
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: args.headline,
        description,
        url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs,
      },
    ],
  };
}
