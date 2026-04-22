/**
 * Contract-tested marketing copy: pricing comparison table, commercial terms bullets,
 * metering clarifier (sign-in + homepage), security quick-fact line.
 * Plan metadata stays in config/commercial-plans.json; numeric caps in the table must match that file
 * (see website/__tests__/pricing-comparison-numeric-parity.contract.test.ts).
 */
import { publicProductAnchors } from "@/lib/publicProductAnchors";
/** GitHub anchor for docs/commercial-ssot.md — keep in sync with heading text in that file. */
export const COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_ANCHOR = "programmatic-verification-vs-licensed-cli";

export const COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_HREF = `${publicProductAnchors.gitRepositoryUrl}/blob/main/docs/commercial-ssot.md#${COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_ANCHOR}`;

/** Same verbatim string on sign-in and homepage commercial strip (render tests assert equality). */
export const METERING_CLARIFIER = `In-process library use (createDecisionGate) evaluates read-only SQL without calling the license reserve API. The published npm CLI path—contract verify, quick with lock flags, and enforce—requires an API key and POST /api/v1/usage/reserve. Boundary: ${COMMERCIAL_SSOT_PROGRAMMATIC_VS_CLI_HREF}`;

/** Two normative lines from docs/commercial-entitlement-policy.md — commercial-pricing-policy-parity.test.mjs requires these substrings in this file. */
export const NORMATIVE_PAID_VERIFICATION_LINE =
  "Licensed verification with the published npm CLI requires an active Individual, Team, Business, or Enterprise subscription (trial counts); monthly quota applies after subscribe.";

export const NORMATIVE_ENFORCEMENT_CI_LINE =
  "CI locks, the enforce command, and quick verify with lock flags use the same subscription requirement.";

export const PRICING_COMMERCIAL_TERMS_BULLETS = [
  {
    lead: "Paid verification" as const,
    body: `${NORMATIVE_PAID_VERIFICATION_LINE}`,
  },
  {
    lead: "Enforcement and CI" as const,
    body: `${NORMATIVE_ENFORCEMENT_CI_LINE}`,
  },
  {
    lead: "Contracts" as const,
    body: "Limits and semantics: OpenAPI at /openapi-commercial-v1.yaml, plans JSON at /api/v1/commercial/plans, and entitlement docs on GitHub main.",
  },
] as const;

export type PlanColumn = "starter" | "individual" | "team" | "business" | "enterprise";

export type PricingComparisonRow = {
  feature: string;
} & Record<PlanColumn, string>;

export const PRICING_FEATURE_COMPARISON = {
  title: "Compare plans in detail",
  columnLabels: ["Capability", "Starter", "Individual", "Team", "Business", "Enterprise"] as const,
  rows: [
    {
      feature: "Verify locally with an OSS build from source (no subscription)",
      starter: "Yes",
      individual: "Yes",
      team: "Yes",
      business: "Yes",
      enterprise: "Yes",
    },
    {
      feature: "Fail CI on contract mismatch using OSS build agentskeptic verify (non-zero exit)",
      starter: "Yes",
      individual: "Yes",
      team: "Yes",
      business: "Yes",
      enterprise: "Yes",
    },
    {
      feature: "Run published npm contract verify / quick in CI with API key + reserve",
      starter: "No",
      individual: "Yes",
      team: "Yes",
      business: "Yes",
      enterprise: "Yes",
    },
    {
      feature: "Lock compare (--expect-lock) and enforce on published npm",
      starter: "No",
      individual: "Yes",
      team: "Yes",
      business: "Yes",
      enterprise: "Yes",
    },
    {
      feature: "Included paid verifications / month (published npm metered)",
      starter: "None (subscribe for quota)",
      individual: "2,000",
      team: "10,000",
      business: "50,000",
      enterprise: "Custom",
    },
    {
      feature:
        "OSS — generate --output-lock fixtures (compare / enforce on published npm remains commercial)",
      starter: "Yes",
      individual: "Yes",
      team: "Yes",
      business: "Yes",
      enterprise: "Yes",
    },
  ] as const satisfies readonly PricingComparisonRow[],
};

/** Third bullet (index 2) on Security quick facts — quick preview vs contract for high-stakes reliance. */
export const SECURITY_QUICK_VS_CONTRACT_BULLET =
  "Quick verify is a preview path; contract verification with an Outcome Certificate is what the engine treats as decision-grade for matches—see outcome-certificate-normative on GitHub for highStakesReliance rules.";

