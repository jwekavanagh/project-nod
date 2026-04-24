import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getMeteringClarifier,
  getHomeCommercialSection,
  getNormativePolicySurfaceLines,
  getPricingCommercialTermsBullets,
  getPricingFeatureComparison,
  getPricingPageHeroNarrative,
} from "@/lib/commercialNarrative";
import { getRepoRoot } from "./helpers/distributionGraphHelpers";
import type { CommercialPlansFile } from "@/lib/plans";

function loadFixtureCatalog(): CommercialPlansFile {
  const root = getRepoRoot();
  const raw = readFileSync(join(root, "config", "commercial-plans.json"), "utf8");
  return JSON.parse(raw) as CommercialPlansFile;
}

describe("commercialNarrative vs commercial-plans.json", () => {
  const catalog = loadFixtureCatalog();

  it("metering clarifier matches prior programmatic-v-CLI URL shape", () => {
    const t = getMeteringClarifier();
    expect(t).toContain("POST /api/v1/usage/reserve");
    expect(t).toMatch(
      /docs\/commercial\.md#programmatic-verification-vs-licensed-cli/,
    );
  });

  it("paid verification body uses formatted starter.includedMonthly from JSON", () => {
    const bullets = getPricingCommercialTermsBullets(catalog);
    const paid = bullets.find((b) => b.lead === "Paid verification");
    expect(paid).toBeTruthy();
    const n = catalog.plans.starter.includedMonthly;
    expect(n).not.toBeNull();
    const fmt = new Intl.NumberFormat("en-US").format(n!);
    expect(paid!.body).toContain(fmt);
  });

  it("feature table included row matches plan caps", () => {
    const t = getPricingFeatureComparison(catalog);
    const row = t.rows.find((r) => r.feature.startsWith("Included CI verifications"));
    expect(row).toBeTruthy();
    const fmt = new Intl.NumberFormat("en-US");
    expect(row!.starter).toBe(fmt.format(catalog.plans.starter.includedMonthly!));
    expect(row!.individual).toBe(fmt.format(catalog.plans.individual.includedMonthly!));
    expect(row!.team).toBe(fmt.format(catalog.plans.team.includedMonthly!));
    expect(row!.business).toBe(fmt.format(catalog.plans.business.includedMonthly!));
  });

  it("hero and home do not use unqualified always-free for licensed path", () => {
    const hero = getPricingPageHeroNarrative(catalog);
    expect(hero.subtitle.toLowerCase()).not.toMatch(/local and open-source verification is always free/);
    const home = getHomeCommercialSection(catalog);
    expect(home.strip.toLowerCase()).toMatch(/pricing|github|commercial/);
  });

  it("getNormativePolicySurfaceLines matches first two commercial terms bodies", () => {
    const [a, b] = getNormativePolicySurfaceLines(catalog);
    const terms = getPricingCommercialTermsBullets(catalog);
    expect(a).toBe(terms[0]!.body);
    expect(b).toBe(terms[1]!.body);
  });
});
