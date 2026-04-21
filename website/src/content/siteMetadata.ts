import { supportPageMetadata } from "@/content/productCopy";

export const siteMetadata = {
  integrate: {
    title: "Get started",
    description:
      "Install Node.js 22.13+, Git, and npm. Follow the command block to clone, install, build, run the bundled demo, then first-run verify with read-only SQL. Crossing on your SQLite is a mechanical checkpoint—not ProductionComplete on your emitters. Cold clones may take several minutes.",
  },
  security: {
    title: "Security & Trust — AgentSkeptic",
    description:
      "High-level data handling, verification boundary, and links to authoritative product and commercial documentation.",
  },
  support: {
    title: supportPageMetadata.title,
    description: supportPageMetadata.description,
  },
  claim: {
    title: "Claim verification run — AgentSkeptic",
    description:
      "Connect an open-source CLI verification run to your account after opening the claim link from your terminal and signing in with email (magic link may open in a new tab on the same browser).",
  },
  /** Relative to `metadataBase` (canonical production origin). */
  openGraphImage: {
    path: "/og.png",
    width: 1200,
    height: 630,
    alt: "AgentSkeptic — read-only SQL checks against structured tool activity",
  },
} as const;
