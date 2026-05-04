import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { conversionSpine, productCopy } from "@/content/productCopy";
import { enterpriseMailtoHref } from "@/lib/contactSalesEmail";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const contactSegmentTitle = "Contact";
const contactPublicTitle = brandedMarketingTitle(contactSegmentTitle);
const contactDescription =
  "Reach Enterprise sales for procurement, custom limits, and contract terms. Other questions route through Support.";

export const metadata: Metadata = {
  title: contactSegmentTitle,
  description: contactDescription,
  alternates: { canonical: indexableGuideCanonical("/contact") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({ title: contactPublicTitle, description: contactDescription }),
};

export default function ContactPage() {
  const salesMailto = enterpriseMailtoHref();

  return (
    <MarketingPageShell variant="documentProse" className="contact-page">
      <MarketingPageHeader
        title="Contact"
        description={
          <p className="contact-lede">
            For Enterprise procurement, tailored limits, on-prem options, or custom contract terms, reach sales
            directly.
          </p>
        }
      />
      <p>
        <Link
          className="btn"
          href="/pricing"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          View pricing
        </Link>
      </p>
      <p>
        <a
          className="btn secondary"
          href={salesMailto}
          data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}
        >
          {productCopy.pricingBillingAndQuestionsBand.enterpriseCtaLabel}
        </a>
      </p>
      <p className="muted contact-support-note">
        For product issues, integration help, or bugs, use{" "}
        <Link href="/support">{productCopy.pricingBillingAndQuestionsBand.secondaryLinks[1].label}</Link>
        .
      </p>
    </MarketingPageShell>
  );
}
