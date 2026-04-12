import { IndexedGuideShell } from "@/components/guides/IndexedGuideShell";
import { getIndexableGuide, indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import Link from "next/link";

const path = "/guides/verify-langgraph-workflows";

export const metadata: Metadata = {
  title: "Verify LangGraph workflows against your database — AgentSkeptic",
  description:
    "Map LangGraph-style structured tool activity to NDJSON events, run read-only SQL verification, and understand ROW_ABSENT when traces look green.",
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical(path) },
};

export default function LangGraphVerificationGuidePage() {
  const g = getIndexableGuide(path);
  return (
    <IndexedGuideShell>
      <h1>Verify LangGraph workflows against your database</h1>
      <p className="lede">{g.problemAnchor}</p>
      <p className="lede">
        AgentSkeptic compares that <strong>declared</strong> activity to <strong>observed</strong> SQLite or Postgres rows
        using read-only <code>SELECT</code>s—not trace success flags.
      </p>
      <ol className="mechanism-list">
        <li>
          Export or capture <strong>structured tool activity</strong> (JSON or NDJSON) from your graph run—the same
          shapes you would feed to Quick Verify or contract verification (see the <code>/integrate</code> first-run
          guide linked below this article).
        </li>
        <li>
          Maintain a <strong>tools registry</strong> mapping <code>toolId</code> to SQL row checks for contract mode, or
          start with Quick Verify for inferred checks.
        </li>
        <li>
          Run <code>agentskeptic verify</code> or <code>agentskeptic quick</code> locally. To publish a{" "}
          <strong>private</strong> HTML artifact for Slack or tickets, pass{" "}
          <code>--share-report-origin https://agentskeptic.com</code> (replace with your deployment origin when
          self-hosting). Those <code>/r/…</code> URLs are <strong>noindex</strong> by design so they are not used for
          organic discovery.
        </li>
        <li>
          For <strong>indexable</strong> discovery pages that explain the trace-vs-database gap, use{" "}
          <Link href="/guides">/guides</Link> and the acquisition page at{" "}
          <Link href="/database-truth-vs-traces">/database-truth-vs-traces</Link>—not <code>/r/</code> links.
        </li>
      </ol>
      <p className="lede">
        Normative contracts:{" "}
        <Link href="https://github.com/jwekavanagh/agentskeptic/blob/main/docs/shareable-verification-reports.md">
          docs/shareable-verification-reports.md
        </Link>
        .
      </p>
    </IndexedGuideShell>
  );
}
