import { readFileSync } from "node:fs";
import path from "node:path";

export type PlanId = "starter" | "team" | "business" | "enterprise";

export type CommercialPlansFile = {
  schemaVersion: number;
  plans: Record<
    PlanId,
    {
      includedMonthly: number | null;
      monthlyUsdCents: number | null;
      displayPrice: string;
      marketingHeadline: string;
      stripePriceEnvKey: string | null;
    }
  >;
};

export function loadCommercialPlans(): CommercialPlansFile {
  const p = path.join(process.cwd(), "..", "config", "commercial-plans.json");
  return JSON.parse(readFileSync(p, "utf8")) as CommercialPlansFile;
}

export function loadLegalMetadata(): { effectiveDate: string; termsVersion: string } {
  const p = path.join(process.cwd(), "..", "config", "legal-metadata.json");
  return JSON.parse(readFileSync(p, "utf8")) as {
    effectiveDate: string;
    termsVersion: string;
  };
}
