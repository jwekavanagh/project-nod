import { productCopy } from "@/content/productCopy";
import { enterpriseMailtoHref } from "@/lib/contactSalesEmail";
import { loadCommercialPlans, type PlanId } from "@/lib/plans";
import { PricingClient, type PlanRow } from "./PricingClient";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  const { plans: raw } = loadCommercialPlans();
  const order: PlanId[] = ["starter", "individual", "team", "business", "enterprise"];
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
    };
  });
  const enterpriseMailto = enterpriseMailtoHref();
  return (
    <main>
      <h1>Pricing</h1>
      <p className="muted pricing-recap">{productCopy.pricingRecap}</p>
      <PricingClient plans={plans} enterpriseMailto={enterpriseMailto} />
    </main>
  );
}
