import {
  MarketingContentLink,
  MarketingLinkItem,
  MarketingLinkList,
} from "@/components/marketing/MarketingLinkList";
import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
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
    <MarketingPageShell variant="documentProse" className="learn-hub">
      <MarketingPageHeader
        title={guidesSegmentTitle}
        kicker={<strong>{productCopy.learnHubPrimaryLede}</strong>}
        description={<p className="lede">{productCopy.guidesHubSupportingSentence}</p>}
      />

      <MarketingSection aria-labelledby="learn-popular-heading">
        <h2 id="learn-popular-heading">{learnHub.popularHeading}</h2>
        <MarketingLinkList>
          {learnHub.popular.map((g) => (
            <MarketingLinkItem key={g.href}>
              <MarketingContentLink href={g.href} title={g.title} lines={[g.caption]} />
            </MarketingLinkItem>
          ))}
        </MarketingLinkList>
      </MarketingSection>

      <MarketingSection aria-labelledby="learn-debug-heading">
        <h2 id="learn-debug-heading">{learnHub.debugHeading}</h2>
        <MarketingLinkList>
          {learnHub.debug.map((g) => (
            <MarketingLinkItem key={g.href}>
              <MarketingContentLink href={g.href} title={g.title} lines={[g.caption]} />
            </MarketingLinkItem>
          ))}
        </MarketingLinkList>
      </MarketingSection>

      <MarketingSection className="learn-hub-cta" aria-labelledby="learn-closing-heading">
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
      </MarketingSection>
    </MarketingPageShell>
  );
}
