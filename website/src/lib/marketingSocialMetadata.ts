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
