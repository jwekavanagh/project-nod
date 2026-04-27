import { siteMetadata } from "@/content/siteMetadata";
import type { Metadata } from "next";

const ogImage = {
  url: siteMetadata.openGraphImage.path,
  width: siteMetadata.openGraphImage.width,
  height: siteMetadata.openGraphImage.height,
  alt: siteMetadata.openGraphImage.alt,
} as const;

type MarketingOpenGraphAndTwitterOptions = {
  title: string;
  description: string;
  openGraphType?: "website" | "article";
};

/**
 * Open Graph + Twitter card fields shared across public marketing pages (uses {@link siteMetadata.openGraphImage}).
 */
export function marketingOpenGraphAndTwitter(
  o: MarketingOpenGraphAndTwitterOptions,
): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title: o.title,
      description: o.description,
      type: o.openGraphType ?? "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: o.title,
      description: o.description,
      images: [siteMetadata.openGraphImage.path],
    },
  };
}

export function homePageTitleFromMarketing(heroTitle: string): string {
  const withoutTrailingPeriod = heroTitle.replace(/\s*\.\s*$/u, "");
  return `${withoutTrailingPeriod} — AgentSkeptic`;
}

const BRAND_TITLE_SUFFIX = / — AgentSkeptic$/;

/**
 * Surface markdown `title` fields sometimes already end with " — AgentSkeptic". Strip that so
 * the root `title.template` adds the suffix once for {@link Metadata} `title`.
 */
export function surfaceTitleSegmentForTemplate(surfaceTitle: string): string {
  return surfaceTitle.replace(BRAND_TITLE_SUFFIX, "").trim();
}

/**
 * Full public document/social title when the root layout uses `title.template: "%s — AgentSkeptic"`
 * and the page exports only the **segment** in `metadata.title`.
 * Idempotent if the segment already includes the brand suffix.
 */
export function brandedMarketingTitle(shortPageSegment: string): string {
  const t = shortPageSegment.trim();
  if (BRAND_TITLE_SUFFIX.test(t)) {
    return t;
  }
  return `${t} — AgentSkeptic`;
}
