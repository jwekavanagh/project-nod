import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { companyPageMetadata } from "@/content/productCopy";

export const siteMetadata = {
  title: "AgentSkeptic — check database state against what your workflow claimed",
  description: discoveryAcquisition.pageMetadata.description,
  integrate: {
    title: "Run your first verification",
    description:
      "One command: clone AgentSkeptic, build, and run a bundled read-only check that compares workflow claims to SQL.",
  },
  security: {
    title: "Security & Trust — AgentSkeptic",
    description:
      "High-level data handling, verification boundary, and links to authoritative product and commercial documentation.",
  },
  company: {
    title: companyPageMetadata.title,
    description: companyPageMetadata.description,
  },
  openGraph: {
    title: "AgentSkeptic — check database state against what your workflow claimed",
    description: discoveryAcquisition.pageMetadata.description,
  },
  /** Relative to `metadataBase` (canonical production origin). */
  openGraphImage: {
    path: "/og.png",
    width: 1200,
    height: 630,
    alt: "AgentSkeptic — read-only SQL checks against structured tool activity",
  },
} as const;
