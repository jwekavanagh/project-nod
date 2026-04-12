import { IndexedGuideShell } from "@/components/guides/IndexedGuideShell";
import { proseCiGreenLogs } from "@/content/guideScenarioProse";
import { getIndexableGuide, indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";

const path = "/guides/ci-green-logs-row-absent";

export const metadata: Metadata = {
  title: "CI passed on logs but database side effect missing — AgentSkeptic",
  description:
    "Green CI on workflow logs does not prove rows landed. Gate with read-only SQL verification of structured tool activity.",
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical(path) },
};

export default function CiGreenLogsRowAbsentGuidePage() {
  const g = getIndexableGuide(path);
  return (
    <IndexedGuideShell>
      <h1>CI green logs, row absent</h1>
      <p className="lede">{g.problemAnchor}</p>
      {proseCiGreenLogs()}
    </IndexedGuideShell>
  );
}
