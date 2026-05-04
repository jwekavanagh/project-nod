import { conversionSpine, productCopy } from "@/content/productCopy";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const compareSegmentTitle = "Compare approaches";
const comparePublicTitle = brandedMarketingTitle(compareSegmentTitle);
const compareDescription =
  "Choose the right reliability layer. See how read-only verification compares with offline evals, observability dashboards, and trace-only review—using read-only checks against stored state before you ship.";

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
    contrast: "Offline evals measure model quality.",
    ours: "AgentSkeptic checks whether the workflow wrote the correct data to your stores.",
  },
  {
    id: "compare-hub-observability",
    href: "/compare/observability-vs-preaction-gate",
    title: "Observability dashboards vs. pre-action gates",
    contrast: "Dashboards show what happened after the fact.",
    ours: "AgentSkeptic gives you a clear gate before you ship, bill, or hand off to customers.",
  },
  {
    id: "compare-hub-traces",
    href: "/compare/traces-vs-read-only-sql-verification",
    title: "Trace-only review vs. read-only verification",
    contrast: "Traces show what the tool said happened.",
    ours: "AgentSkeptic checks whether stored state matches those claims.",
  },
] as const;

export default function CompareHubPage() {
  return (
    <main className="integrate-main integrate-prose" data-testid="compare-hub-page">
      <h1>Compare approaches</h1>
      <p className="integrate-benefit-lede">
        <strong>Choose the right reliability layer.</strong>
      </p>
      <p className="lede">See how read-only verification compares with common alternatives.</p>

      {SECTIONS.map((s) => (
        <section key={s.href} className="home-section" aria-labelledby={s.id}>
          <h2 id={s.id}>
            <Link href={s.href} className="guide-hub-link">
              <span className="guide-hub-link-title">{s.title}</span>
            </Link>
          </h2>
          <p className="lede">{s.contrast}</p>
          <p className="lede">{s.ours}</p>
        </section>
      ))}

      <section className="home-section" aria-labelledby="compare-hub-cta-heading">
        <h2 id="compare-hub-cta-heading">Ready to see it in action?</h2>
        <div className="home-cta-row">
          <a
            className="btn"
            href="/verify"
            data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
          >
            {productCopy.ctaTaxonomy.topOfFunnel}
          </a>
        </div>
      </section>
    </main>
  );
}
