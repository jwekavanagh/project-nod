import { IndexedGuideShell } from "@/components/guides/IndexedGuideShell";
import { proseTraceGreenPostgres } from "@/content/guideScenarioProse";
import { getIndexableGuide, indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";

const path = "/guides/trace-green-postgres-row-missing";

export const metadata: Metadata = {
  title: "Green LangGraph trace but missing Postgres row — AgentSkeptic",
  description:
    "When traces look green but the Postgres row is wrong or absent, use read-only SQL verification against structured tool activity—not trace success flags.",
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical(path) },
};

export default function TraceGreenPostgresRowMissingGuidePage() {
  const g = getIndexableGuide(path);
  return (
    <IndexedGuideShell>
      <h1>Green trace, missing Postgres row</h1>
      <p className="lede">{g.problemAnchor}</p>
      {proseTraceGreenPostgres()}
    </IndexedGuideShell>
  );
}
