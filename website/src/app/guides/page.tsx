import { conversionSpine, learnHub, productCopy } from "@/content/productCopy";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const guidesSegmentTitle = "Learn how to verify agent outcomes";
const guidesPublicTitle = brandedMarketingTitle(guidesSegmentTitle);

export const metadata: Metadata = {
  title: guidesSegmentTitle,
  description: productCopy.learnHubIndexDescription,
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical("/guides") },
  ...marketingOpenGraphAndTwitter({ title: guidesPublicTitle, description: productCopy.learnHubIndexDescription }),
};

export default function GuidesHubPage() {
  return (
    <main className="integrate-main integrate-prose learn-hub">
      <h1>{guidesSegmentTitle}</h1>
      <p className="integrate-benefit-lede">
        <strong>{productCopy.learnHubPrimaryLede}</strong>
      </p>
      <p className="lede">{productCopy.guidesHubSupportingSentence}</p>

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

      <section className="home-section learn-hub-cta" aria-labelledby="learn-closing-heading">
        <h2 id="learn-closing-heading" className="learn-hub-cta-heading">
          {learnHub.closingTitle}
        </h2>
        <p className="lede">{learnHub.closingBody}</p>
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
            Try the missing-write demo
          </Link>
        </p>
      </section>
    </main>
  );
}
