import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

export type CommercialPlansFile = {
  schemaVersion: number;
  /** Website pricing highlight only; not exposed on public plans API. */
  recommendedPlanId: PlanId;
  plans: Record<
    PlanId,
    {
      includedMonthly: number | null;
      monthlyUsdCents: number | null;
      displayPrice: string;
      marketingHeadline: string;
      audience: string;
      valueUnlock: string;
      stripePriceEnvKey: string | null;
    }
  >;
};

export function loadCommercialPlans(): CommercialPlansFile {
  const dir = resolveConfigDir();
  const p = path.join(dir, "commercial-plans.json");
  return JSON.parse(readFileSync(p, "utf8")) as CommercialPlansFile;
}

export function loadLegalMetadata(): { effectiveDate: string; termsVersion: string } {
  const dir = resolveConfigDir();
  const p = path.join(dir, "legal-metadata.json");
  return JSON.parse(readFileSync(p, "utf8")) as {
    effectiveDate: string;
    termsVersion: string;
  };
}
