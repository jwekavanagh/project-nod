import primaryMarketing from "@/lib/primaryMarketing";

export const siteMetadata = {
  integrate: primaryMarketing.site.integrate,
  openGraphImage: primaryMarketing.site.openGraph.image,
  security: primaryMarketing.site.security,
  support: primaryMarketing.site.support,
  claim: primaryMarketing.site.claim,
} as const;
