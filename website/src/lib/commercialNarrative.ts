/**
 * Sole public TypeScript source for site-facing commercial + contract phrasing
 * (pricing, metering clarifier, feature table, terms bullets, home commercial block).
 * Data SSOT: config/commercial-plans.json. Presentation uses loadCommercialPlans only here.
 */
import marketing from "@/lib/marketing";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
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

export const COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_ANCHOR =
  "programmatic-verification-vs-licensed-cli" as const;

const ssotPath = `${publicProductAnchors.gitRepositoryUrl}/blob/main/docs/commercial.md#${COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_ANCHOR}`;

export const COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_HREF = ssotPath;

const fmt = new Intl.NumberFormat("en-US");

function formatCount(n: number): string {
  return fmt.format(n);
}

/**
 * Full in-process vs licensed npm metering clarifier. On the homepage it prefixes the home commercial `strip`
 * (the short `HOME_COMMERCIAL_LEAD` is the muted lede above it).
 */
export function getMeteringClarifier(): string {
  return `In-process library use (createDecisionGate) evaluates read-only SQL without calling the license reserve API. The published npm CLI path—contract verify, quick with lock flags, and enforce—requires an API key and POST /api/v1/usage/reserve. Boundary: ${ssotPath}`;
}

/** Short lede for the home commercial block; `getMeteringClarifier()` and quota copy live in `strip`. */
export const HOME_COMMERCIAL_LEAD =
  "Open-source CLI (unmetered locally), in-process createDecisionGate for in-code use, and commercial OpenAPI with licensed npm for CI and production." as const;

/** Security page quick-fact: outcome certificate vs quick verify (index 2 in the four-bullet list). */
export const outcomeCertificateQuickFactBullet =
  "Quick verify is a preview path; contract verification with an Outcome Certificate is what the engine treats as decision-grade for matches—see outcome-certificate-normative on GitHub for highStakesReliance rules." as const;

export function getSecurityQuickFacts(): {
  title: string;
  bullets: readonly [string, string, string, string];
} {
  return {
    title: "Quick facts for buyers",
    bullets: [
      "CLI and verification engine run in your infrastructure against databases you configure; the homepage demo runs bundled fixtures on this server for evaluation only.",
      "Structured tool activity is compared to database query results at verification time; that check does not prove a specific network call caused a row.",
      outcomeCertificateQuickFactBullet,
      "For the on-site buyer trust summary, use the trust buyer guide on this site; full normative verification semantics stay in verification-product.md on GitHub.",
    ] as const,
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

export function getPricingFeatureComparison(catalog: CommercialPlansFile): PricingFeatureComparison {
  const s = catalog.plans.starter;
  const i = catalog.plans.individual;
  const t = catalog.plans.team;
  const b = catalog.plans.business;
  const incStarter = s.includedMonthly;
  if (incStarter == null) {
    throw new Error("commercialNarrative: starter.includedMonthly is required for comparison table");
  }
  return {
    title: "Plan comparison",
    columnLabels: ["Capability", "Starter", "Individual", "Team", "Business", "Enterprise"] as const,
    rows: [
      {
        feature: "Local OSS verification",
        starter: "Yes",
        individual: "Yes",
        team: "Yes",
        business: "Yes",
        enterprise: "Yes",
      },
      {
        feature: "Fail CI on mismatch (OSS build)",
        starter: "Yes",
        individual: "Yes",
        team: "Yes",
        business: "Yes",
        enterprise: "Yes",
      },
      {
        feature: "Published npm CLI + API key (licensed / metered)",
        starter: `${formatCount(incStarter)} / mo (hard cap, per key)`,
        individual: "Yes + overage",
        team: "Yes + overage",
        business: "Yes + overage",
        enterprise: "Custom",
      },
      {
        feature: "Lock / enforce commands (paid only)",
        starter: "No",
        individual: "Yes",
        team: "Yes",
        business: "Yes",
        enterprise: "Yes",
      },
      {
        feature: "Included CI verifications (per key; then overage on paid plans)",
        starter: formatCount(incStarter),
        individual: formatCount(i.includedMonthly ?? 0),
        team: formatCount(t.includedMonthly ?? 0),
        business: formatCount(b.includedMonthly ?? 0),
        enterprise: "Custom",
      },
    ],
  };
}

function paidVerificationBody(catalog: CommercialPlansFile): string {
  const n = catalog.plans.starter.includedMonthly;
  if (n == null) {
    throw new Error("commercialNarrative: starter.includedMonthly is required for paid verification line");
  }
  return `Starter includes ${formatCount(n)} published npm CLI verifications per month (hard cap, no overage). Individual, Team, and Business include higher monthly amounts plus pay-as-you-go overage; an active subscription is required (trial counts).`;
}

const enforcementAndCIBody =
  "CI locks, the enforce command, and quick verify with lock flags require a paid plan (not Starter) and the same active subscription and metering model." as const;

const contractsBody =
  "Limits and semantics: OpenAPI at /openapi-commercial-v1.yaml, plans JSON at /api/v1/commercial/plans, and entitlement docs on GitHub main." as const;

export type CommercialTermsBullet = {
  lead: "Paid verification" | "Enforcement and CI" | "Contracts";
  body: string;
};

export function getPricingCommercialTermsBullets(catalog: CommercialPlansFile): readonly CommercialTermsBullet[] {
  return [
    { lead: "Paid verification", body: paidVerificationBody(catalog) },
    { lead: "Enforcement and CI", body: enforcementAndCIBody },
    { lead: "Contracts", body: contractsBody },
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
  const cap = catalog.plans.starter.includedMonthly;
  if (cap == null) {
    throw new Error("commercialNarrative: starter.includedMonthly is required for hero");
  }
  return {
    subtitle: `Local and open-source (OSS) paths are unmetered. The published npm CLI with a Starter account includes up to ${formatCount(cap)} licensed verifications per key per month; paid self-serve plans add more included usage, then metered overage on licensed runs when you pass that quota.`,
    subtitleSecondary:
      "Paid self-serve plans also unlock the enforce and lock-failure paths. Enterprise is contract.",
  };
}

export function getHomeCommercialSection(catalog: CommercialPlansFile): {
  title: string;
  lead: string;
  strip: string;
} {
  const cap = catalog.plans.starter.includedMonthly;
  if (cap == null) {
    throw new Error("commercialNarrative: starter.includedMonthly is required for home section");
  }
  return {
    title: "First-run integration",
    lead: HOME_COMMERCIAL_LEAD,
    strip: `${getMeteringClarifier()} Run licensed verification in CI: Starter includes ${formatCount(
      cap,
    )} runs per key per month (no overage); higher tiers add more included volume. Local OSS and in-process createDecisionGate stay unmetered. In-process library use never calls the usage API.`,
  };
}

export function getPricingLocalVerificationFootnote(): string {
  return "Local OSS verification remains free forever.";
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
  /** Flat string for <meta name="description">. */
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
