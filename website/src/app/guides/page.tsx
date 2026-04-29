import { conversionSpine, learnHub, productCopy } from "@/content/productCopy";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import { listAllSurfaces } from "@/lib/surfaceMarkdown";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

const guidesSegmentTitle = "Learn";
const guidesPublicTitle = brandedMarketingTitle(guidesSegmentTitle);

export const metadata: Metadata = {
  title: guidesSegmentTitle,
  description: productCopy.learnHubIndexDescription,
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical("/guides") },
  ...marketingOpenGraphAndTwitter({ title: guidesPublicTitle, description: productCopy.learnHubIndexDescription }),
};

function bundledExampleLabel(route: string, fallbackTitle: string): ReactNode {
  switch (route) {
    case "/examples/wf-complete":
      return (
        <>
          Verified workflow (<code className="learn-hub-code">wf_complete</code>)
        </>
      );
    case "/examples/wf-missing":
      return (
        <>
          Failure with <code className="learn-hub-code">ROW_ABSENT</code> (
          <code className="learn-hub-code">wf_missing</code>)
        </>
      );
    case "/examples/langgraph-checkpoint-trust":
      return "LangGraph checkpoint trust example";
    default:
      return fallbackTitle;
  }
}

export default function GuidesHubPage() {
  const surfaces = listAllSurfaces();
  const examples = surfaces
    .filter((s) => s.route.startsWith("/examples/"))
    .sort((a, b) => {
      const order = (r: string) =>
        r.includes("wf-complete") ? 0 : r.includes("wf-missing") ? 1 : r.includes("langgraph") ? 2 : 3;
      return order(a.route) - order(b.route) || a.route.localeCompare(b.route);
    });

  const bundledMuted = productCopy.learnBundledProofLedes.secondaryMuted.trim();

  return (
    <main className="integrate-main integrate-prose learn-hub">
      <h1>Learn</h1>
      <p className="integrate-benefit-lede">
        <strong>{productCopy.learnHubPrimaryLede}</strong>
      </p>
      <p className="lede">{productCopy.guidesHubSupportingSentence}</p>
      <p className="lede muted learn-hub-intro-bridge">{productCopy.guidesHubBridgeSentence}</p>

      <section className="home-section" aria-labelledby="learn-popular-heading">
        <h2 id="learn-popular-heading">{learnHub.popularHeading}</h2>
        <ul className="mechanism-list guide-hub-list">
          {learnHub.popular.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="guide-hub-link">
                <span className="guide-hub-link-title">{g.title}</span>
                <span className="muted guide-hub-link-caption">{g.caption}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="learn-debug-heading">
        <h2 id="learn-debug-heading">{learnHub.debugHeading}</h2>
        <ul className="mechanism-list guide-hub-list">
          {learnHub.debug.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="guide-hub-link">
                <span className="guide-hub-link-title">{g.title}</span>
                <span className="muted guide-hub-link-caption">{g.caption}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="learn-buyers-heading">
        <h2 id="learn-buyers-heading">{learnHub.buyersHeading}</h2>
        <ul className="mechanism-list guide-hub-list">
          {learnHub.buyers.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="guide-hub-link">
                <span className="guide-hub-link-title">{g.title}</span>
                <span className="muted guide-hub-link-caption">{g.caption}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="bundled-proof" className="home-section" aria-labelledby="bundled-proof-heading">
        <h2 id="bundled-proof-heading">{learnHub.bundledProofHeading}</h2>
        <p className="lede learn-hub-bundled-lead">{productCopy.learnBundledProofLedes.primary}</p>
        {bundledMuted ? <p className="lede muted">{bundledMuted}</p> : null}
        <ul className="mechanism-list guide-hub-list">
          {examples.map((e) => (
            <li key={e.route}>
              <Link href={e.route} className="guide-hub-link">
                <span className="guide-hub-link-title">{bundledExampleLabel(e.route, e.title)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section learn-hub-cta" aria-labelledby="learn-closing-heading">
        <h2 id="learn-closing-heading" className="learn-hub-cta-heading">
          {learnHub.closingTitle}
        </h2>
        <p className="home-cta-row">
          <Link
            href="/integrate"
            className="btn"
            data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
          >
            {productCopy.ctaTaxonomy.decision}
          </Link>
          <Link
            href="/verify"
            className="btn secondary"
            data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}
          >
            {productCopy.ctaTaxonomy.topOfFunnel}
          </Link>
        </p>
      </section>
    </main>
  );
}
