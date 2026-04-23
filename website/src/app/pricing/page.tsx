import { PRICING_COMMERCIAL_TERMS_BULLETS } from "@/content/marketingContracts";
import { productCopy } from "@/content/productCopy";
import { enterpriseMailtoHref } from "@/lib/contactSalesEmail";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import { loadCommercialPlans, type PlanId } from "@/lib/plans";
import Link from "next/link";
import { PricingClient, type PlanRow } from "./PricingClient";
import { PricingCompareTable } from "./PricingCompareTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing — AgentSkeptic",
  description: `${productCopy.pricingHero.positioning} ${productCopy.pricingHero.subtitle} ${productCopy.pricingHero.subtitleSecondary}`,
  alternates: { canonical: indexableGuideCanonical("/pricing") },
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  const commercial = loadCommercialPlans();
  const raw = commercial.plans;
  const order: PlanId[] = ["starter", "individual", "team", "business", "enterprise"];
  const recommendedPlanId = commercial.recommendedPlanId;
  const plans: PlanRow[] = order.map((id) => {
    const p = raw[id];
    return {
      id,
      checkoutPlanId: p.stripePriceEnvKey !== null ? id : null,
      headline: p.marketingHeadline,
      displayPrice: p.displayPrice,
      includedMonthly: p.includedMonthly,
      audience: p.audience,
      valueUnlock: p.valueUnlock,
      recommended: id === recommendedPlanId,
    };
  });
  const enterpriseMailto = enterpriseMailtoHref();
  const hero = productCopy.pricingHero;
  const paid = productCopy.pricingWhatYouGetPaidPlans;
  const billing = productCopy.pricingBillingAndQuestionsBand;

  return (
    <main className="pricing-page">
      <h1 className="pricing-hero-title">{hero.title}</h1>
      <p className="pricing-positioning">{hero.positioning}</p>
      <section className="pricing-hero-block" data-testid="pricing-hero-recap" aria-label="Pricing summary">
        <p className="pricing-hero-subtitle" data-testid="pricing-plan-choice-guide">
          {hero.subtitle}
        </p>
        {hero.subtitleSecondary.length > 0 ? (
          <p className="pricing-hero-subtitle pricing-hero-subtitle-secondary">{hero.subtitleSecondary}</p>
        ) : null}
      </section>

      <section
        className="pricing-example pricing-unlock-before-plans"
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
          {productCopy.pricingLocalVerificationFreeFootnote}
        </p>
      </section>

      <h2 className="pricing-plans-heading">{productCopy.pricingPlansSectionTitle}</h2>
      <PricingClient plans={plans} enterpriseMailto={enterpriseMailto} />

      <PricingCompareTable />

      <details className="pricing-commercial-details">
        <summary className="pricing-commercial-details-summary">
          {productCopy.pricingCommercialTermsDetailsSummary}
        </summary>
        <ul aria-label="Commercial terms" className="muted pricing-commercial-terms">
          {PRICING_COMMERCIAL_TERMS_BULLETS.map((row) => (
            <li key={row.lead}>
              <strong>{row.lead}</strong> {row.body}
            </li>
          ))}
        </ul>
      </details>

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
    </main>
  );
}
