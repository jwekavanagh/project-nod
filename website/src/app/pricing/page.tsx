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
  title: productCopy.pricingHero.title,
  description: `${productCopy.pricingHero.positioning} ${productCopy.pricingHero.subtitle}`,
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
  const example = productCopy.pricingHeroExample;

  return (
    <main className="pricing-page">
      <h1 className="pricing-hero-title">{hero.title}</h1>
      <p className="pricing-positioning">{hero.positioning}</p>
      <p className="muted">
        <Link href="/guides/buyer-commercial-boundary">{productCopy.pricingBuyerCommercialBoundaryLinkLabel}</Link>
      </p>
      <section className="pricing-hero-block" data-testid="pricing-hero-recap" aria-label="Pricing summary">
        <p className="pricing-hero-subtitle" data-testid="pricing-plan-choice-guide">
          {hero.subtitle}
        </p>
      </section>

      <p className="muted" data-testid="pricing-compare-lead">
        {productCopy.pricingCompareLead}{" "}
        <Link href="/compare">{productCopy.commercialSurface.compareApproachesLabel}</Link>
      </p>

      <section className="pricing-example" data-testid="pricing-example" aria-labelledby="pricing-example-title">
        <h2 id="pricing-example-title" className="pricing-example-heading">
          {example.title}
        </h2>
        <ul>
          {example.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </section>

      <p className="pricing-risk muted" data-testid="pricing-risk-reassurance">
        {productCopy.pricingRiskReassurance}
      </p>

      <PricingClient plans={plans} enterpriseMailto={enterpriseMailto} />

      <PricingCompareTable />

      <ul aria-label="Commercial terms" className="muted pricing-commercial-terms">
        {PRICING_COMMERCIAL_TERMS_BULLETS.map((row) => (
          <li key={row.lead}>
            <strong>{row.lead}</strong> {row.body}
          </li>
        ))}
      </ul>

      <section data-testid="pricing-trust-band" aria-labelledby="pricing-trust-band-title">
        <h2 id="pricing-trust-band-title">{productCopy.pricingTrustBandBeforeGrid.title}</h2>
        <p>{productCopy.pricingTrustBandBeforeGrid.paragraphs[0]}</p>
        <p>{productCopy.pricingTrustBandBeforeGrid.paragraphs[1]}</p>
        <p className="pricing-trust-band-links">
          <Link href={productCopy.pricingTrustBandBeforeGrid.links[0].href}>
            {productCopy.pricingTrustBandBeforeGrid.links[0].label}
          </Link>
          <span className="pricing-trust-band-links-sep" aria-hidden="true">
            ·
          </span>
          <Link href={productCopy.pricingTrustBandBeforeGrid.links[1].href}>
            {productCopy.pricingTrustBandBeforeGrid.links[1].label}
          </Link>
        </p>
      </section>
    </main>
  );
}
