import { IndexedGuideShell } from "@/components/guides/IndexedGuideShell";
import { proseToolLoopCrm } from "@/content/guideScenarioProse";
import { getIndexableGuide, indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";

const path = "/guides/tool-loop-success-crm-state-wrong";

export const metadata: Metadata = {
  title: "Tool loop said success but CRM state is wrong — AgentSkeptic",
  description:
    "OpenAI-style tool loops can report success while CRM or SQLite rows disagree. Verify with read-only SQL against structured tool parameters.",
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical(path) },
};

export default function ToolLoopSuccessCrmStateWrongGuidePage() {
  const g = getIndexableGuide(path);
  return (
    <IndexedGuideShell>
      <h1>Tool loop success, CRM state wrong</h1>
      <p className="lede">{g.problemAnchor}</p>
      {proseToolLoopCrm()}
    </IndexedGuideShell>
  );
}
