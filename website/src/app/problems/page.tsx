import { DiscoveryArticleJsonLd } from "@/components/discovery/DiscoveryArticleJsonLd";
import {
  MarketingContentLink,
  MarketingLinkItem,
  MarketingLinkList,
} from "@/components/marketing/MarketingLinkList";
import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { conversionSpine, productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const problemsDescription = productCopy.problemsPageMetadata.description;
const problemsSegmentTitle = productCopy.problemsPageMetadata.title;
const problemsPublicTitle = brandedMarketingTitle(problemsSegmentTitle);

export const metadata: Metadata = {
  title: problemsSegmentTitle,
  description: problemsDescription,
  alternates: { canonical: indexableGuideCanonical("/problems") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({
    title: problemsPublicTitle,
    description: problemsDescription,
  }),
};

export default function ProblemsPage() {
  const rows = marketing.problemIndex;
  return (
    <MarketingPageShell variant="documentProse">
      <DiscoveryArticleJsonLd
        headline={productCopy.problemsPageMetadata.title}
        description={productCopy.problemsPageMetadata.description}
        path="/problems"
        breadcrumbMiddle={{ name: "Learn", path: "/guides" }}
      />
      <MarketingPageHeader
        title={productCopy.problemsPageMetadata.title}
        description={<p className="lede">{productCopy.problemsPageMetadata.supportingLine}</p>}
      />
      <MarketingLinkList>
        {rows.map((row, i) => (
          <MarketingLinkItem key={`${row.primaryRoute}-${i}`}>
            <MarketingContentLink
              href={row.primaryRoute}
              title={row.moment}
              lines={
                "verificationCue" in row && typeof row.verificationCue === "string"
                  ? [row.symptom, row.verificationCue]
                  : [row.symptom]
              }
            />
          </MarketingLinkItem>
        ))}
      </MarketingLinkList>
      <p className="home-cta-row">
        <Link
          href="/integrate"
          className="btn"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {productCopy.ctaTaxonomy.decision}
        </Link>
      </p>
    </MarketingPageShell>
  );
}
