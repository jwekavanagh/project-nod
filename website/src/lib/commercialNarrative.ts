/**
 * Site-facing commercial + contract phrasing. Numeric/data SSOT: config/commercial-plans.json.
 * Buyer-facing narrative: config/buyer-truth.v1.json (loaded via @/lib/buyerTruth).
 */
import marketing from "@/lib/marketing";
import {
  exportBuyerFacingProjection,
  frameworkFootnotePlainText,
  interpolate,
  loadBuyerTruth,
  substitutionVarsFromCatalog,
} from "@/lib/buyerTruth";
import {
  loadCommercialPlans,
  planHasSelfServeCheckout,
  type CommercialPlansFile,
  type PlanId,
} from "@/lib/plans";

/** Pricing grid row; used by the client `PricingClient` and server view model. */
export type PlanRow = {
  id: PlanId;
  checkoutPlanId: PlanId | null;
  headline: string;
  displayPrice: string;
  displayPriceYearly: string | null;
  overageDisplayLabel: string | null;
  includedMonthly: number | null;
  audience: string;
  valueUnlock: string;
  recommended: boolean;
};

export const COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_HREF = loadBuyerTruth().canonicalHref.commercialBoundary;

export const HOME_COMMERCIAL_BOUNDARY_DOCS = {
  href: COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_HREF,
  label: "See the commercial boundary docs.",
} as const;

const fmt = new Intl.NumberFormat("en-US");

function formatCount(n: number): string {
  return fmt.format(n);
}

/**
 * Full in-process vs licensed npm metering clarifier. Used in pricing and policy surfaces; the homepage
 * commercial block uses a shorter lede and a linked boundary doc line instead of `getMeteringClarifier()`.
 */
export function getMeteringClarifier(): string {
  const href = loadBuyerTruth().canonicalHref.commercialBoundary;
  return `In-process library use (createDecisionGate) evaluates read-only SQL without calling the license reserve API. The published npm CLI path—contract verify, quick with lock flags, and enforce—requires an API key and POST /api/v1/usage/reserve. Boundary: ${href}`;
}

export function getHomeCommercialLead(): string {
  const bt = loadBuyerTruth();
  return interpolate(bt.commercialEntryPoints.homeCommercialLeadMarkdown, {});
}

export function getFrameworkFootnoteForHomepage(): string {
  return frameworkFootnotePlainText(loadBuyerTruth());
}

export function getOutcomeCertificateQuickFactBullet(): string {
  return loadBuyerTruth().securityQuickFactsBullets[2];
}

export function getSecurityQuickFacts(): {
  title: string;
  bullets: readonly [string, string, string, string];
} {
  const b = loadBuyerTruth().securityQuickFactsBullets;
  return {
    title: "Quick facts for buyers",
    bullets: [b[0], b[1], b[2], b[3]] as const,
  };
}

export type PlanColumn = "starter" | "individual" | "team" | "business" | "enterprise";

export type PricingComparisonRow = {
  feature: string;
} & Record<PlanColumn, string>;

export type PricingFeatureComparison = {
  title: string;
  columnLabels: readonly ["Capability", "Starter", "Individual", "Team", "Business", "Enterprise"];
  rows: readonly PricingComparisonRow[];
};

const planColumns: readonly PlanColumn[] = ["starter", "individual", "team", "business", "enterprise"];

export function getPricingFeatureComparison(catalog: CommercialPlansFile): PricingFeatureComparison {
  const bt = loadBuyerTruth();
  const vars = substitutionVarsFromCatalog(catalog);
  const rows = bt.pricing.comparisonRows.map((row) => {
    const cells = row.cells as Record<string, string>;
    const starter = interpolate(String(cells.starter ?? ""), vars);
    const individual = interpolate(String(cells.individual ?? ""), vars);
    const team = interpolate(String(cells.team ?? ""), vars);
    const business = interpolate(String(cells.business ?? ""), vars);
    const enterprise = interpolate(String(cells.enterprise ?? ""), vars);
    return {
      feature: row.featureDisplay,
      starter,
      individual,
      team,
      business,
      enterprise,
    };
  });

  return {
    title: "Plan comparison",
    columnLabels: ["Capability", "Starter", "Individual", "Team", "Business", "Enterprise"] as const,
    rows,
  };
}

export function paidVerificationTermsBody(catalog: CommercialPlansFile): string {
  return interpolate(loadBuyerTruth().pricing.paidVerificationTemplate, substitutionVarsFromCatalog(catalog));
}

export type CommercialTermsBullet = {
  lead: "Paid verification" | "Enforcement and CI" | "Contracts";
  body: string;
};

export function getPricingCommercialTermsBullets(catalog: CommercialPlansFile): readonly CommercialTermsBullet[] {
  const bt = loadBuyerTruth();
  const vars = substitutionVarsFromCatalog(catalog);
  return [
    { lead: "Paid verification", body: interpolate(bt.pricing.paidVerificationTemplate, vars) },
    { lead: "Enforcement and CI", body: bt.pricing.enforcementMarkdown },
    { lead: "Contracts", body: bt.pricing.contractsMarkdown },
  ] as const;
}

/** Normative “Paid verification” + “Enforcement and CI” lines (e2e, policy tests). */
export function getNormativePolicySurfaceLines(
  catalog: CommercialPlansFile,
): readonly [string, string] {
  const b = getPricingCommercialTermsBullets(catalog);
  return [b[0]!.body, b[1]!.body];
}

export function getPricingPageHeroNarrative(
  catalog: CommercialPlansFile,
): { subtitle: string; subtitleSecondary: string } {
  const bt = loadBuyerTruth();
  const vars = substitutionVarsFromCatalog(catalog);
  return {
    subtitle: interpolate(bt.pricing.pricingHeroSubtitleTemplate, vars),
    subtitleSecondary: bt.pricing.pricingHeroSubtitleSecondary,
  };
}

export function getHomeCommercialSection(catalog: CommercialPlansFile): {
  title: string;
  lead: string;
  strip: string;
} {
  if (catalog.plans.starter.includedMonthly == null) {
    throw new Error("commercialNarrative: starter.includedMonthly is required for home section");
  }
  return {
    title: "Open source and commercial",
    lead: getHomeCommercialLead(),
    strip: "",
  };
}

export function getPricingLocalVerificationFootnote(): string {
  return loadBuyerTruth().pricing.localVerificationFootnote;
}

export function getCompareApproachesLabel(): string {
  return "Compare approaches";
}

export function getPricingPageViewModel(catalog: CommercialPlansFile): {
  heroTitle: string;
  heroPositioning: string;
  heroSubtitle: string;
  heroSubtitleSecondary: string;
  planRows: PlanRow[];
  termsBullets: ReturnType<typeof getPricingCommercialTermsBullets>;
  featureComparison: PricingFeatureComparison;
  localVerificationFootnote: string;
  metadataDescription: string;
} {
  const m = marketing.site.pricing;
  const heroN = getPricingPageHeroNarrative(catalog);
  const order: PlanId[] = ["starter", "individual", "team", "business", "enterprise"];
  const recommendedPlanId = catalog.recommendedPlanId;
  const raw = catalog.plans;
  const planRows: PlanRow[] = order.map((id) => {
    const p = raw[id]!;
    return {
      id,
      checkoutPlanId: planHasSelfServeCheckout(p) ? id : null,
      headline: p.marketingHeadline,
      displayPrice: p.displayPrice,
      displayPriceYearly: p.displayPriceYearly,
      overageDisplayLabel: p.overageDisplayLabel,
      includedMonthly: p.includedMonthly,
      audience: p.audience,
      valueUnlock: p.valueUnlock,
      recommended: id === recommendedPlanId,
    };
  });
  const metadataDescription = [m.positioning, heroN.subtitle, heroN.subtitleSecondary]
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
  return {
    heroTitle: m.heroTitle,
    heroPositioning: m.positioning,
    heroSubtitle: heroN.subtitle,
    heroSubtitleSecondary: heroN.subtitleSecondary,
    planRows,
    termsBullets: getPricingCommercialTermsBullets(catalog),
    featureComparison: getPricingFeatureComparison(catalog),
    localVerificationFootnote: getPricingLocalVerificationFootnote(),
    metadataDescription,
  };
}

/** For pages that do not have the catalog; loads JSON once. */
export function getPricingPageViewModelFromConfig(): ReturnType<typeof getPricingPageViewModel> {
  return getPricingPageViewModel(loadCommercialPlans());
}

export function getHomeCommercialSectionFromConfig(): ReturnType<typeof getHomeCommercialSection> {
  return getHomeCommercialSection(loadCommercialPlans());
}

/** CI / Vitest projection equality against committed snapshot JSON. */
export function getCommittedBuyerFacingProjection(): Record<string, string> {
  return exportBuyerFacingProjection(loadCommercialPlans());
}
