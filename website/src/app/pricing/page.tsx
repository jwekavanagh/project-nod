import { productCopy } from "@/content/productCopy";
import { TrustPills } from "@/components/marketing/TrustPills";
import { ValuePropTriptych } from "@/components/marketing/ValuePropTriptych";
import { WhenToUseDecisionBox } from "@/components/marketing/WhenToUseDecisionBox";
import { enterpriseMailtoHref } from "@/lib/contactSalesEmail";
import { getPricingPageViewModelFromConfig } from "@/lib/commercialNarrative";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import Link from "next/link";
import { PricingClient } from "./PricingClient";
import { PricingCompareTable } from "./PricingCompareTable";

/** Plans and copy come from `config/commercial-plans.json` (build-time); ISR keeps TTFB low. */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const vm = getPricingPageViewModelFromConfig();
  return {
    title: "Pricing — AgentSkeptic",
    description: vm.metadataDescription,
    alternates: { canonical: indexableGuideCanonical("/pricing") },
    robots: { index: true, follow: true },
  };
}

export default function PricingPage() {
  const vm = getPricingPageViewModelFromConfig();
  const enterpriseMailto = enterpriseMailtoHref();
  const paid = productCopy.pricingWhatYouGetPaidPlans;
  const billing = productCopy.pricingBillingAndQuestionsBand;

  return (
    <main className="pricing-page">
      <h1 className="pricing-hero-title">{vm.heroTitle}</h1>
      <p className="pricing-positioning">{vm.heroPositioning}</p>
      <section className="pricing-hero-block" data-testid="pricing-hero-recap" aria-label="Pricing summary">
        <p className="pricing-hero-subtitle" data-testid="pricing-plan-choice-guide">
          {vm.heroSubtitle}
        </p>
        {vm.heroSubtitleSecondary.length > 0 ? (
          <p className="pricing-hero-subtitle pricing-hero-subtitle-secondary">
            {vm.heroSubtitleSecondary}
          </p>
        ) : null}
        <TrustPills items={productCopy.trustStripPills} />
      </section>

      <ValuePropTriptych
        problem={productCopy.coreValuePropTriptych.problem}
        solution={productCopy.coreValuePropTriptych.solution}
        outcome={productCopy.coreValuePropTriptych.outcome}
      />

      <section className="pricing-example" aria-labelledby="what-paid-plans-enable">
        <h2 id="what-paid-plans-enable" className="pricing-example-heading">
          What paid plans enable
        </h2>
        <ul>
          <li>Prevent false-green releases before they reach customers or compliance workflows.</li>
          <li>Catch missing side effects early, reducing incident cleanup and support churn.</li>
          <li>Turn verification into a repeatable CI gate with deterministic artifacts.</li>
        </ul>
      </section>

      <WhenToUseDecisionBox
        id="pricing-when-to-use-heading"
        title={productCopy.whenToUseDecisionBox.title}
        strongFitHeading={productCopy.whenToUseDecisionBox.strongFitHeading}
        notDesignedHeading={productCopy.whenToUseDecisionBox.notDesignedHeading}
        strongFitBullets={productCopy.whenToUseDecisionBox.strongFitBullets}
        notDesignedBullets={productCopy.whenToUseDecisionBox.notDesignedBullets}
      />
      <h2 className="pricing-plans-heading">{productCopy.pricingPlansSectionTitle}</h2>
      <PricingClient plans={vm.planRows} enterpriseMailto={enterpriseMailto} />

      <section
        className="pricing-example"
        data-testid="pricing-what-you-get"
        aria-labelledby="pricing-what-you-get-title"
      >
        <h2 id="pricing-what-you-get-title" className="pricing-example-heading">
          {paid.title}
        </h2>
        <ul>
          {paid.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="pricing-risk muted" data-testid="pricing-risk-reassurance">
          {vm.localVerificationFootnote}
        </p>
      </section>

      <PricingCompareTable featureComparison={vm.featureComparison} />

      <section data-testid="pricing-trust-band" aria-labelledby="pricing-trust-band-title">
        <h2 id="pricing-trust-band-title">{billing.billingTitle}</h2>
        <div className="pricing-billing-prose muted">
          {billing.billingParagraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        <p className="pricing-questions-lead">{billing.questionsTitle}</p>
        <p className="pricing-trust-band-links">
          <Link href={billing.enterpriseCtaHref}>{billing.enterpriseCtaLabel}</Link>
          <span className="pricing-trust-band-links-sep" aria-hidden="true">
            ·
          </span>
          <Link href={billing.secondaryLinks[0].href}>{billing.secondaryLinks[0].label}</Link>
          <span className="pricing-trust-band-links-sep" aria-hidden="true">
            ·
          </span>
          <Link href={billing.secondaryLinks[1].href}>{billing.secondaryLinks[1].label}</Link>
        </p>
      </section>

      <details className="pricing-commercial-details pricing-commercial-details-end">
        <summary className="pricing-commercial-details-summary">
          {productCopy.pricingCommercialTermsDetailsSummary}
        </summary>
        <ul aria-label="Commercial terms" className="muted pricing-commercial-terms">
          {vm.termsBullets.map((row) => (
            <li key={row.lead}>
              <strong>{row.lead}</strong> {row.body}
            </li>
          ))}
        </ul>
      </details>
    </main>
  );
}
