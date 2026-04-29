import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import commercialPlansBundled from "../../../config/commercial-plans.json";
import legalMetadataBundled from "../../../config/legal-metadata.json";

/**
 * Resolve repo `config/` whether the dev server cwd is `website/` or the monorepo root
 * (npm workspaces / tooling sometimes leaves cwd at the workspace root).
 */
function resolveConfigDir(): string {
  const candidates = [
    path.join(process.cwd(), "config"),
    path.join(process.cwd(), "..", "config"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "commercial-plans.json"))) {
      return dir;
    }
  }
  throw new Error(
    `Cannot find config/commercial-plans.json (tried ${candidates.join(", ")}; cwd=${process.cwd()})`,
  );
}

export type PlanId = "starter" | "individual" | "team" | "business" | "enterprise";

/** Paid-capable plans: licensed verify/enforce when `subscriptionStatus === "active"` (plus break-glass rules). */
export const paidEnforcementPlanIds: readonly PlanId[] = [
  "individual",
  "team",
  "business",
  "enterprise",
];

export type PlanDefinition = {
  includedMonthly: number | null;
  monthlyUsdCents: number | null;
  /** Annual prepay (self-serve); null if not sold as yearly. */
  yearlyUsdCents: number | null;
  displayPrice: string;
  displayPriceYearly: string | null;
  /** Micro-USD per verification; 15_000 = $0.015 (overage line after included). */
  overageMicrousdPerVerification: number | null;
  allowOverage: boolean;
  overageDisplayLabel: string | null;
  marketingHeadline: string;
  audience: string;
  valueUnlock: string;
  stripePriceEnvKeyMonthly: string | null;
  stripePriceEnvKeyYearly: string | null;
  stripeOveragePriceEnvKey: string | null;
};

export type CommercialPlansFile = {
  schemaVersion: number;
  /** Website pricing highlight only; not exposed on public plans API. */
  recommendedPlanId: PlanId;
  plans: Record<PlanId, PlanDefinition>;
};

export function loadCommercialPlans(): CommercialPlansFile {
  try {
    const dir = resolveConfigDir();
    const p = path.join(dir, "commercial-plans.json");
    return JSON.parse(readFileSync(p, "utf8")) as CommercialPlansFile;
  } catch {
    /**
     * Serverless bundles do not always include repo `config/` on disk (cwd / tracing gaps).
     * A static import guarantees the catalog ships in the JS output so routes like `/account` never 500.
     */
    return commercialPlansBundled as CommercialPlansFile;
  }
}

export function planHasSelfServeCheckout(def: PlanDefinition): boolean {
  return def.stripePriceEnvKeyMonthly !== null;
}

export function loadLegalMetadata(): { effectiveDate: string; termsVersion: string } {
  try {
    const dir = resolveConfigDir();
    const p = path.join(dir, "legal-metadata.json");
    return JSON.parse(readFileSync(p, "utf8")) as {
      effectiveDate: string;
      termsVersion: string;
    };
  } catch {
    return legalMetadataBundled as { effectiveDate: string; termsVersion: string };
  }
}
