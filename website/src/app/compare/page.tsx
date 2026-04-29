import { ValuePropTriptych } from "@/components/marketing/ValuePropTriptych";
import { conversionSpine, productCopy } from "@/content/productCopy";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const compareSegmentTitle = "Compare approaches";
const comparePublicTitle = brandedMarketingTitle(compareSegmentTitle);
const compareDescription =
  "Choose the right reliability layer: how read-only verification differs from offline evals, observability dashboards, and trace-only review—grounded in your stores before you ship.";

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
    contrast: "Offline evaluations measure model quality.",
    ours: "AgentSkeptic verifies whether the workflow actually wrote the correct data to your stores.",
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
    contrast: "Traces tell you what the tool said happened.",
    ours: "AgentSkeptic tells you whether the stored state actually matches those claims.",
  },
] as const;

export default function CompareHubPage() {
  return (
    <main className="integrate-main integrate-prose" data-testid="compare-hub-page">
      <h1>Compare approaches</h1>
      <p className="integrate-benefit-lede">
        <strong>Choose the right reliability layer.</strong>
      </p>
      <p className="lede">
        See how read-only verification differs from — and improves upon — common alternatives.
      </p>
      <ValuePropTriptych
        problem={productCopy.coreValuePropTriptych.problem}
        solution={productCopy.coreValuePropTriptych.solution}
        outcome={productCopy.coreValuePropTriptych.outcome}
      />

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
        <div className="home-cta-row" role="group" aria-label="Run verification or try interactive demo">
          <Link
            className="btn"
            href={productCopy.homeHeroSecondaryCta.href}
            data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
          >
            {productCopy.ctaTaxonomy.consideration}
          </Link>
          <a
            className="btn secondary"
            href="/verify"
            data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}
          >
            {productCopy.ctaTaxonomy.topOfFunnel}
          </a>
        </div>
      </section>
    </main>
  );
}
