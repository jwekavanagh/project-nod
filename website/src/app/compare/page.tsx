import { MarketingContentLink } from "@/components/marketing/MarketingLinkList";
import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { conversionSpine } from "@/content/productCopy";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";

const compareSegmentTitle = "Compare reliability approaches";
const comparePublicTitle = brandedMarketingTitle(compareSegmentTitle);
const compareDescription =
  "Choose the right layer for the failure you need to catch. Evals, dashboards, and traces are useful — but they do not prove the expected data landed in your stores; AgentSkeptic verifies stored state against the workflow claim.";

export const metadata: Metadata = {
  title: compareSegmentTitle,
  description: compareDescription,
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical("/compare") },
  ...marketingOpenGraphAndTwitter({ title: comparePublicTitle, description: compareDescription }),
};

const SECTIONS = [
  {
    id: "compare-hub-offline-evals",
    href: "/compare/evals-vs-row-gates",
    title: "Offline evals vs. real stored-state gates",
    contrast: "Offline evals help you measure model or agent quality before deployment.",
    ours: "AgentSkeptic checks whether a real workflow produced the expected stored state before you ship, bill, or continue.",
  },
  {
    id: "compare-hub-observability",
    href: "/compare/observability-vs-preaction-gate",
    title: "Observability dashboards vs. pre-action gates",
    contrast: "Dashboards help you investigate what happened after a workflow ran.",
    ours: "AgentSkeptic gives you a deterministic gate before the result reaches customers, revenue, or downstream systems.",
  },
  {
    id: "compare-hub-traces",
    href: "/compare/traces-vs-read-only-sql-verification",
    title: "Trace-only review vs. read-only verification",
    contrast: "Traces show what the agent and tools reported.",
    ours: "AgentSkeptic re-reads your stores to verify whether those claims match reality.",
  },
] as const;

export default function CompareHubPage() {
  return (
    <MarketingPageShell variant="documentProse" data-testid="compare-hub-page">
      <MarketingPageHeader
        title={compareSegmentTitle}
        kicker={<strong>Choose the right layer for the failure you need to catch.</strong>}
        description={
          <p className="lede">
            Evals, dashboards, and traces are useful — but they do not prove that the expected data landed in your
            stores.
          </p>
        }
      />

      {SECTIONS.map((s) => (
        <MarketingSection key={s.href} aria-labelledby={s.id}>
          <h2 id={s.id}>
            <MarketingContentLink href={s.href} title={s.title} />
          </h2>
          <p className="lede">{s.contrast}</p>
          <p className="lede">{s.ours}</p>
        </MarketingSection>
      ))}

      <MarketingSection aria-labelledby="compare-hub-cta-heading">
        <h2 id="compare-hub-cta-heading">Ready to test the difference?</h2>
        <p className="lede">
          Run the missing-write demo and see a green-looking workflow fail against stored state.
        </p>
        <div className="home-cta-row">
          <a
            className="btn"
            href="/verify"
            data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
          >
            Try the missing-write demo
          </a>
        </div>
      </MarketingSection>
    </MarketingPageShell>
  );
}
