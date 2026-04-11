import discoveryAcquisition from "@/lib/discoveryAcquisition";

export const siteMetadata = {
  title: "Workflow Verifier — check database state against what your workflow claimed",
  description: discoveryAcquisition.pageMetadata.description,
  integrate: {
    title: "Integrate — first run on your database",
    description:
      "Copy-paste steps: NDJSON tool observations, tools.json registry, SQLite or Postgres, and the workflow-verifier CLI.",
  },
  openGraph: {
    title: "Workflow Verifier — check database state against what your workflow claimed",
    description: discoveryAcquisition.pageMetadata.description,
  },
  /** Relative to `metadataBase` (canonical production origin). */
  openGraphImage: {
    path: "/og.png",
    width: 1200,
    height: 630,
    alt: "Workflow Verifier — read-only SQL checks against structured tool activity",
  },
} as const;
