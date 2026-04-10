import { publicProductAnchors } from "@/lib/publicProductAnchors";

export const siteMetadata = {
  title: "Workflow Verifier — check database state against what your workflow claimed",
  description: publicProductAnchors.identityOneLiner,
  integrate: {
    title: "Integrate — first run on your database",
    description:
      "Copy-paste steps: NDJSON tool observations, tools.json registry, SQLite or Postgres, and the workflow-verifier CLI.",
  },
  openGraph: {
    title: "Workflow Verifier — check database state against what your workflow claimed",
    description: publicProductAnchors.identityOneLiner,
  },
} as const;
