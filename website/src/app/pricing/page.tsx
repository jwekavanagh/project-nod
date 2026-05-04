import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { productCopy } from "@/content/productCopy";
import { TrustPills } from "@/components/marketing/TrustPills";
import { enterpriseMailtoHref } from "@/lib/contactSalesEmail";
import { getPricingPageViewModelFromConfig } from "@/lib/commercialNarrative";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";
import { PricingCompareTable } from "./PricingCompareTable";

/** Plans and copy come from `config/commercial-plans.json` (build-time); ISR keeps TTFB low. */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const vm = getPricingPageViewModelFromConfig();
  const pricingPublicTitle = brandedMarketingTitle(vm.heroTitle);
  return {
    title: vm.heroTitle,
    description: vm.metadataDescription,
    alternates: { canonical: indexableGuideCanonical("/pricing") },
    robots: { index: true, follow: true },
    ...marketingOpenGraphAndTwitter({ title: pricingPublicTitle, description: vm.metadataDescription }),
  };
}

export default function PricingPage() {
  const vm = getPricingPageViewModelFromConfig();
  const enterpriseMailto = enterpriseMailtoHref();

  return (
    <MarketingPageShell variant="pricing">
      <MarketingPageHeader
        title={vm.heroTitle}
        description={
          <>
            <p className="pricing-positioning">{vm.heroSupporting}</p>
            <p className="pricing-hero-subtitle">{vm.heroPositioning}</p>
          </>
        }
      />
      <section className="pricing-hero-block" data-testid="pricing-hero-recap" aria-label="Pricing summary">
        <TrustPills items={productCopy.trustStripPills} />
      </section>

      <h2 className="pricing-plans-heading">{productCopy.pricingPlansSectionTitle}</h2>
      <p className="pricing-plans-intro muted">{productCopy.pricingPlansIntro}</p>
      <PricingClient plans={vm.planRows} enterpriseMailto={enterpriseMailto} />

      <PricingCompareTable featureComparison={vm.featureComparison} />
    </MarketingPageShell>
  );
}
