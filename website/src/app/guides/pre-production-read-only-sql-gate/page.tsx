import { IndexedGuideShell } from "@/components/guides/IndexedGuideShell";
import { prosePreProductionGate } from "@/content/guideScenarioProse";
import { getIndexableGuide, indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";

const path = "/guides/pre-production-read-only-sql-gate";

export const metadata: Metadata = {
  title: "Pre-production read-only SQL gate — AgentSkeptic",
  description:
    "Before customer-facing actions, run read-only verification that persisted rows match structured tool activity—not more log volume.",
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical(path) },
};

export default function PreProductionReadOnlySqlGateGuidePage() {
  const g = getIndexableGuide(path);
  return (
    <IndexedGuideShell>
      <h1>Pre-production read-only SQL gate</h1>
      <p className="lede">{g.problemAnchor}</p>
      {prosePreProductionGate()}
    </IndexedGuideShell>
  );
}
