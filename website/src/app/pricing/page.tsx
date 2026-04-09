import { loadCommercialPlans } from "@/lib/plans";
import { PricingClient, type PlanRow } from "./PricingClient";

export default function PricingPage() {
  const { plans: raw } = loadCommercialPlans();
  const order = ["starter", "team", "business", "enterprise"] as const;
  const plans: PlanRow[] = order.map((id) => {
    const p = raw[id];
    return {
      id,
      headline: p.marketingHeadline,
      displayPrice: p.displayPrice,
      includedMonthly: p.includedMonthly,
    };
  });
  return (
    <main>
      <PricingClient plans={plans} />
    </main>
  );
}
