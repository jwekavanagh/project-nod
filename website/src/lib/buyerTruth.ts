/**
 * Sole SSOT loader for buyer-facing narrative (config/buyer-truth.v1.json).
 * Imported JSON is bundled client + server safe (AccountClient consumes urgency copy).
 * Mechanical billing truth remains docs/commercial.md — do not redefine reserve math here.
 */
import buyerTruthJson from "../../../config/buyer-truth.v1.json";

import type { CommercialPlansFile } from "@/lib/plans";

export type BuyerTruthV1 = {
  schemaVersion: number;
  projectionVersion: number;
  quota: {
    model: string;
    pooledExplanation: string;
  };
  frameworkClaims: ReadonlyArray<{
    id: string;
    displayName: string;
    status: "supported" | "removed" | "experimental";
  }>;
  frameworkFootnoteSuffix: string;
  verificationPaths: {
    quickSqlOnlyDisclaimer: string;
    mechanismCalloutAppend: string;
  };
  integrateRequirements: readonly string[];
  commercialEntryPoints: {
    homeCommercialLeadMarkdown: string;
  };
  pricing: {
    pricingHeroSubtitleTemplate: string;
    pricingHeroSubtitleSecondary: string;
    paidVerificationTemplate: string;
    enforcementMarkdown: string;
    contractsMarkdown: string;
    localVerificationFootnote: string;
    comparisonRows: ReadonlyArray<{
      featureKey: string;
      featureDisplay: string;
      cells: Record<string, string>;
    }>;
  };
  accountQuotaUrgency: Record<"ok" | "notice" | "warning" | "in_overage" | "at_cap" | "zero_usage", string>;
  securityQuickFactsBullets: readonly [string, string, string, string];
  canonicalHref: {
    verificationSemantics: string;
    commercialSsotDoc: string;
    commercialBoundary: string;
  };
  readmeSegments: {
    commercialEntry: readonly string[];
  };
  homepageCopy: {
    valueProposition: string;
    mechanismWorksWith: string;
  };
};

const fmt = new Intl.NumberFormat("en-US");

function formatCount(n: number): string {
  return fmt.format(n);
}

export function loadBuyerTruth(): BuyerTruthV1 {
  return buyerTruthJson as unknown as BuyerTruthV1;
}

export function interpolate(template: string, vars: Record<string, string>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`{{\\s*${k}\\s*}}`, "g");
    s = s.replace(re, v);
  }
  return s;
}

export function substitutionVarsFromCatalog(c: CommercialPlansFile): Record<string, string> {
  const s = c.plans.starter.includedMonthly;
  const i = c.plans.individual.includedMonthly;
  const t = c.plans.team.includedMonthly;
  const b = c.plans.business.includedMonthly;
  if (s == null) throw new Error("buyerTruth: starter missing includedMonthly");
  return {
    starterIncluded: formatCount(s),
    starterIncludedDigits: String(s),
    individualIncludedDigits: formatCount(i ?? 0),
    teamIncludedDigits: formatCount(t ?? 0),
    businessIncludedDigits: formatCount(b ?? 0),
  };
}

export function frameworkFootnotePlainText(bt: BuyerTruthV1): string {
  const parts = bt.frameworkClaims.map((c) => {
    if (c.status === "supported") return `${c.displayName}: supported`;
    if (c.status === "removed") return `${c.displayName}: removed (not shipped in current Python integration tracks)`;
    return `${c.displayName}: experimental`;
  });
  return `${parts.join(". ")}. ${bt.frameworkFootnoteSuffix}`.trim();
}

export type QuotaUrgency = "ok" | "notice" | "warning" | "in_overage" | "at_cap";

/** Account urgency copy keyed by worstUrgency (pool-only wording). */
export function quotaUrgencyCopyFor(kind: QuotaUrgency | null, bt: BuyerTruthV1): string | null {
  if (kind === null || kind === undefined) return null;
  if (kind === "ok") return bt.accountQuotaUrgency.ok;
  if (kind === "notice") return bt.accountQuotaUrgency.notice;
  if (kind === "warning") return bt.accountQuotaUrgency.warning;
  if (kind === "in_overage") return bt.accountQuotaUrgency.in_overage;
  if (kind === "at_cap") return bt.accountQuotaUrgency.at_cap;
  return null;
}

export function quotaUrgencyZeroUsage(bt: BuyerTruthV1): string {
  return bt.accountQuotaUrgency.zero_usage;
}

/**
 * Canonical ordered record for CI snapshot equality (`exportBuyerFacingProjection`).
 * Keys are stable lexicographically sorted JSON.stringify for committed snap.
 */
export function exportBuyerFacingProjection(catalog: CommercialPlansFile): Record<string, string> {
  const bt = loadBuyerTruth();
  const vars = substitutionVarsFromCatalog(catalog);

  const out: Record<string, string> = {
    pooled_explanation: bt.quota.pooledExplanation,
    framework_footnote: frameworkFootnotePlainText(bt),
    home_commercial_lead: interpolate(bt.commercialEntryPoints.homeCommercialLeadMarkdown, {}),
    home_value_proposition: bt.homepageCopy.valueProposition,
    home_mechanism_works_with: bt.homepageCopy.mechanismWorksWith,
    integrate_requirements_concat: [...bt.integrateRequirements].join("|"),
    pricing_hero_subtitle_primary: interpolate(bt.pricing.pricingHeroSubtitleTemplate, vars),
    pricing_hero_subtitle_secondary: bt.pricing.pricingHeroSubtitleSecondary,
    paid_verification_terms: interpolate(bt.pricing.paidVerificationTemplate, vars),
    enforcement_terms: bt.pricing.enforcementMarkdown,
    contracts_terms: bt.pricing.contractsMarkdown,
    local_verify_footnote: bt.pricing.localVerificationFootnote,
    canon_verification_semantics_href: bt.canonicalHref.verificationSemantics,
    canon_commercial_ssot_doc_href: bt.canonicalHref.commercialSsotDoc,
    canon_commercial_boundary_href: bt.canonicalHref.commercialBoundary,
    quick_sql_only_disclaimer: bt.verificationPaths.quickSqlOnlyDisclaimer,
    mechanism_callout_append: bt.verificationPaths.mechanismCalloutAppend,
    outcome_certificate_quick_fact: bt.securityQuickFactsBullets[2],
    security_quick_fact_a: bt.securityQuickFactsBullets[0],
    security_quick_fact_b: bt.securityQuickFactsBullets[1],
    security_quick_fact_c: bt.securityQuickFactsBullets[2],
    security_quick_fact_d: bt.securityQuickFactsBullets[3],
    readme_commercial_joined: bt.readmeSegments.commercialEntry.join("\n"),
    account_quota_ok: bt.accountQuotaUrgency.ok,
    account_quota_notice: bt.accountQuotaUrgency.notice,
    account_quota_warning: bt.accountQuotaUrgency.warning,
    account_quota_in_overage: bt.accountQuotaUrgency.in_overage,
    account_quota_at_cap: bt.accountQuotaUrgency.at_cap,
    account_quota_zero: bt.accountQuotaUrgency.zero_usage,
  };

  bt.pricing.comparisonRows.forEach((row, idx) => {
    (["starter", "individual", "team", "business", "enterprise"] as const).forEach((col) => {
      const cell = row.cells[col as string];
      if (cell === undefined) return;
      out[`pricing_row_${idx}_${row.featureKey}_${col}`] = interpolate(cell, vars);
    });
    out[`pricing_row_${idx}_${row.featureKey}_label`] = row.featureDisplay;
  });

  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export const BUYER_TRUTH_PROJECTION_SNAPSHOT_REL = "website/src/generated/buyerTruthProjection.snap.json";
export const BUYER_TRUTH_HASH_REL = "website/src/generated/buyerTruthCodegenHash.ts";
