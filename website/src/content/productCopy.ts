/** Single source for most site chrome, a11y, and test ids. Buyer semantics: `config/buyer-truth.v1.json` via `@/lib/buyerTruth`. */

import { loadBuyerTruth } from "@/lib/buyerTruth";

import marketing from "@/lib/marketing";

const bt = loadBuyerTruth();

export type InternalHref =
  | "/security"
  | "/support"
  | "/pricing"
  | "/privacy"
  | "/terms"
  | "/integrate"
  | "/contact";

export type PricingBillingAndQuestionsBand = {
  billingTitle: string;
  billingParagraphs: readonly [string, string, string];
  questionsTitle: string;
  enterpriseCtaLabel: string;
  enterpriseCtaHref: "/contact";
  secondaryLinks: readonly [{ label: string; href: "/security" }, { label: string; href: "/support" }];
};

export type SupportPage = {
  h1: string;
  intro: string;
  sections: readonly [
    {
      kind: "supportIssues";
      h2: string;
      paragraph: string;
      issuesLinkLabel: string;
    },
    {
      kind: "buying";
      h2: string;
      paragraph: string;
      cta: { label: string; href: "/pricing" };
    },
    {
      kind: "legal";
      h2: string;
      links: readonly [
        { label: string; href: "/security" },
        { label: string; href: "/privacy" },
        { label: string; href: "/terms" },
      ];
    },
    {
      kind: "artifacts";
      h2: string;
      items: readonly [{ label: string; key: "source" }, { label: string; key: "npm" }];
    },
  ];
};

export type SupportPageMetadata = { title: string; description: string };

export type LearnBundledProofLedes = { primary: string; secondaryMuted: string };

export type HomeHeroCtaLabels = { demo: string };
export type ConversionSpineCtaLabel =
  | "Try interactive demo"
  | "Run the missing-write demo"
  | "See a failed vs passed run"
  | "See a failed run"
  | "See a passed run"
  | "Run on sample data in 5 minutes"
  | "Run first verification"
  | "Start free"
  | "Continue to checkout"
  | "Sign in to continue"
  | "Continue with email"
  | "View pricing";

export type ConversionSpineRoute =
  | "/"
  | "/database-truth-vs-traces"
  | "/integrate"
  | "/pricing"
  | "/guides"
  | "/guides/[slug]"
  | "/examples/[slug]"
  | "/problems"
  | "/compare"
  | "/compare/[slug]"
  | "/security"
  | "/support"
  | "/contact"
  | "/claim"
  | "/privacy"
  | "/terms";

/** Hero primary CTA — scrolls to bundled Try it. */
export const HOME_HERO_DEMO_CTA_LABEL = "Try interactive demo" as const;

/** Homepage hero + `/` demo band — bundled missing-write proof on `/verify`. */
export const HOME_PAGE_MISSING_WRITE_DEMO_CTA = "Run the missing-write demo" as const;

/** Try-it control — performs POST /api/demo/verify (distinct from scroll CTAs). */
export const HOME_TRY_IT_RUN_BUTTON_LABEL = "Run sample verification" as const;

export const supportPageMetadata = {
  title: "Support and procurement — AgentSkeptic",
  description:
    "How to get support, Enterprise procurement, and links to legal and security documentation.",
} as const satisfies SupportPageMetadata;

export const supportPage = {
  h1: "Support and procurement",
  intro:
    "AgentSkeptic is the commercial product surface for the open-source verifier: structured tool outputs vs downstream state (SQL-first, optional HTTP / vector / S3 / Mongo witnesses per docs/agentskeptic.md).",
  sections: [
    {
      kind: "supportIssues" as const,
      h2: "Support and issues",
      paragraph:
        "For product defects, integration questions, and reproducible bugs, use GitHub Issues on the public repository. That is the default support channel.",
      issuesLinkLabel: "Open GitHub Issues",
    },
    {
      kind: "buying" as const,
      h2: "Buying and Enterprise",
      paragraph:
        "Self-serve plans and Stripe checkout are on Pricing. Enterprise procurement uses Contact sales on the Enterprise pricing card—this page does not publish a sales email address.",
      cta: { label: "View pricing", href: "/pricing" as const },
    },
    {
      kind: "legal" as const,
      h2: "Legal and security",
      links: [
        { label: "Security & Trust", href: "/security" as const },
        { label: "Privacy", href: "/privacy" as const },
        { label: "Terms", href: "/terms" as const },
      ],
    },
    {
      kind: "artifacts" as const,
      h2: "Product artifacts",
      items: [
        { label: "Source", key: "source" as const },
        { label: "npm", key: "npm" as const },
      ],
    },
  ],
} as const satisfies SupportPage;

export const learnBundledProofLedes = {
  primary: "See what verification looks like—no CLI required:",
  /** Learn hub omits this line when empty. */
  secondaryMuted: "",
} as const satisfies LearnBundledProofLedes;

/** Bundled proof section on `/guides`: visible text split around the `/integrate` link. */
export const learnBundledProofIntegrateLede = {
  before: "For first-run on your own stores, follow ",
  after: " for Postgres or SQLite setup, registry shape, and CLI commands.",
} as const;

/**
 * Same checklist tokens as `docs/first-run-integration.md` and `integrate-activation-shell.bash` (OCL surface parity).
 * Values are real substrings; tests require them to appear in this module.
 */
export const adoptionCompleteChecklistTokenRefs = {
  patternComplete: "PatternComplete",
  adoptionCompletePatternComplete: "AdoptionComplete_PatternComplete",
  acTrust01: "AC-TRUST-01",
  acOps01: "AC-OPS-01",
  integrateSpineComplete: "IntegrateSpineComplete",
} as const;

/** Curated Learn hub (`/guides`): benefit-led links; routes must match markdown `route` frontmatter. */
export const learnHub = {
  popularHeading: "Production failure scenarios",
  debugHeading: "Setup and troubleshooting",
  closingTitle: "Ready to prove one workflow?",
  closingBody:
    "Run a first verification against your own readable data, or start with the bundled missing-write demo.",
  popular: [
    {
      href: "/guides/ai-agent-wrong-crm-data",
      title: "AI agent updated the CRM — but the record never landed",
      caption: "Verify CRM writes before you trust customer data.",
    },
    {
      href: "/guides/scenario-green-trace-row-missing",
      title: "LangGraph trace looks healthy — but state is wrong",
      caption: "Catch missing rows, stale rows, and mismatched vector metadata.",
    },
    {
      href: "/guides/scenario-ci-green-side-effect-missing",
      title: "CI passed, but the side effect is missing",
      caption: "Fail the release when the store did not actually update.",
    },
    {
      href: "/guides/tool-loop-success-crm-state-wrong",
      title: 'Tool loop said "success" — CRM or ledger disagrees',
      caption: "Compare declared tool activity with stored state.",
    },
    {
      href: "/guides/scenario-stripe-webhook-ledger-mismatch",
      title: "Stripe webhook returned 200 — but your ledger is off",
      caption: "Reconcile external callbacks with internal records before settlement.",
    },
  ],
  debug: [
    {
      href: "/guides/debug-postgres-after-langgraph",
      title: "Debug after LangGraph or agent runs",
      caption: "Reconcile traces with persisted rows and state.",
    },
    {
      href: "/guides/first-run-verification",
      title: "First-run verification on your own data",
      caption: "Run your first deterministic stored-state check with minimal setup.",
    },
    {
      href: "/guides/pre-production-read-only-sql-gate",
      title: "Add a pre-production read-only gate",
      caption: "Verify stored state before release without writing to your systems.",
    },
  ],
} as const;

export const pricingBillingAndQuestionsBand = {
  billingTitle: "Billing",
  billingParagraphs: [
    "Cancel anytime.",
    "Subscribe with Stripe Checkout and manage everything from your Account page.",
    "In-process library use never calls the usage API.",
  ],
  questionsTitle: "Questions?",
  enterpriseCtaLabel: "Contact sales for Enterprise",
  enterpriseCtaHref: "/contact" as const,
  secondaryLinks: [
    { label: "Security & Trust", href: "/security" as const },
    { label: "Support", href: "/support" as const },
  ],
} as const satisfies PricingBillingAndQuestionsBand;

export const pricingWhatYouGetPaidPlans = {
  title: "What paid plans unlock",
  bullets: [
    "Run verification in CI with explicit exit-code checks you wire (commercial npm reserves usage per docs/commercial.md)",
    "Use locks, enforce, the published npm CLI, and pay-as-you-go overage when you exceed included quota",
    "API keys for licensed features and usage-based billing via Stripe",
  ],
} as const;

/** @deprecated Prefer `pricingWhatYouGetPaidPlans` (same content). */
export const pricingHeroExample = pricingWhatYouGetPaidPlans;

export const pricingPlansSectionTitle = "Plans";

/** `<summary>` for expandable commercial terms on `/pricing`. */
export const pricingCommercialTermsDetailsSummary = "Full commercial terms (expand)";

/** Truthful guidance without implying existing customer mix. */
export const pricingRecommendedPill = "For production CI";

/** Microcopy under Team card (optional; omitted from DOM when empty). */
export const pricingTeamFootnote = "";

/** Primary CTA labels on `/pricing` cards (sign-in still required before checkout). */
export const pricingPlanCtas = {
  starter: { href: "/integrate" as const, label: "Start free" },
  individual: { signInLabel: "Sign in to continue", checkoutLabel: "Continue to checkout" },
  team: { signInLabel: "Sign in to continue", checkoutLabel: "Continue to checkout" },
  business: { signInLabel: "Sign in to continue", checkoutLabel: "Continue to checkout" },
  enterprise: { label: "Contact sales" },
} as const;

export const homeHeroCtaLabels = {
  demo: HOME_HERO_DEMO_CTA_LABEL,
} as const satisfies HomeHeroCtaLabels;

export const conversionSpine = {
  ctaPriorityAttr: "data-cta-priority",
  ctaPriorityPrimaryValue: "primary",
  ctaPrioritySecondaryValue: "secondary",
  allowedLabels: [
    "Try interactive demo",
    "Run the missing-write demo",
    "See a failed vs passed run",
    "See a failed run",
    "See a passed run",
    "Run on sample data in 5 minutes",
    "Run first verification",
    "Start free",
    "Continue to checkout",
    "Sign in to continue",
    "Continue with email",
    "View pricing",
  ] as const,
  dominantByRoute: {
    "/": "Run the missing-write demo",
    "/database-truth-vs-traces": "See a failed run",
    "/integrate": "Run first verification",
    "/pricing": "Start free",
    "/guides": "Run first verification",
    "/guides/[slug]": "Run first verification",
    "/examples/[slug]": "Run on sample data in 5 minutes",
    "/problems": "Run first verification",
    "/compare": "Run on sample data in 5 minutes",
    "/compare/[slug]": "Run on sample data in 5 minutes",
    "/security": "Run first verification",
    "/support": "View pricing",
    "/contact": "View pricing",
    "/claim": "Continue with email",
    "/privacy": "Run first verification",
    "/terms": "Run first verification",
  } as const satisfies Readonly<Record<ConversionSpineRoute, ConversionSpineCtaLabel>>,
} as const;

/** Hero secondary CTA — “Get started” (Install) on most surfaces; see `homePageHeroSecondaryCta` for `/` only. */
export const homeHeroSecondaryCta = {
  href: "/integrate" as const,
  label: "Run first verification",
  testId: "home-hero-get-started" as const,
} as const;

/** Second hero tertiary link on `/` only — same destination as `homeHeroSecondaryCta`. */
export const homePageHeroIntegrateSecondaryLabel = "Run first verification locally" as const;

/** Homepage hero secondary: docs hub; primary remains Try the demo. */
export const homePageHeroSecondaryCta = {
  href: "/guides" as const,
  label: "Read the docs",
  testId: "home-hero-read-docs" as const,
} as const;

export const ctaTaxonomy = {
  awareness: "See a failed run",
  topOfFunnel: "Try interactive demo",
  consideration: "Run on sample data in 5 minutes",
  decision: "Run first verification",
  decisionAlternative: "Start free",
} as const;

export const coreValuePropTriptych = {
  problem: "Agents can report success while data is wrong.",
  solution: "Read-only verification against your actual stores.",
  outcome: "Reduce false-green deployments when enforced as an explicit gate.",
} as const;

export const whenToUseDecisionBox = {
  title: "When to use AgentSkeptic",
  strongFitHeading: "Strong fit",
  notDesignedHeading: "Not designed for",
  strongFitBullets: [
    "You need a release gate that verifies stored state, not just logs.",
    "You already have SQL or other queryable backends (Mongo, S3, HTTP-checked endpoints, or supported vector indexes).",
    "You have seen green traces that still shipped missing or wrong data.",
    "You need CI-friendly, deterministic verification artifacts for handoffs.",
  ],
  notDesignedBullets: [
    "Unstructured logs with no queryable source of truth.",
    "A full APM or observability replacement.",
    "Causal attribution to one exact call without state verification needs.",
    "Teams that cannot emit any structured tool activity.",
  ],
} as const;

export const trustStripPills = [
  {
    title: "Read-only by default",
    supporting: "Verifier does not write to your stores",
  },
  {
    title: "Structured verdict artifacts",
    supporting:
      "Deterministic JSON your CI can fail on, your team can inspect, and your release process can archive.",
  },
] as const;

/** Homepage “How it works” ordered steps (`<ol>` markers are supplied by the list). */
export const homeHowItWorksSteps = [
  {
    lead: "Capture what the agent claimed",
    body: "Your agent emits structured tool activity.",
  },
  {
    lead: "Define what should have changed",
    body: "Map tool IDs to the database rows or stores they affect.",
  },
  {
    lead: "Verify against reality",
    body: "AgentSkeptic re-reads the store and returns a deterministic verdict your CI can enforce.",
  },
] as const;

/**
 * Primary homepage copy (canonical for `/`). Stubs for the same topics remain in
 * `config/marketing.json` for the prose budget; the site renders this object instead.
 */
const homepageDisplay = {
  homeValueProposition: bt.homepageCopy.valueProposition,
  homeWhatCatches: {
    sectionTitle: "What it catches",
    bullets: [
      "Logged a successful write, but the row is missing or wrong in the store.",
      "Green in your trace, but the side effect never landed where it matters.",
      "Revenue, compliance, and support decisions made on a story the database does not back.",
    ] as const,
  },
  homeStakes: {
    sectionTitle: "Why it stings in production",
    stakesTagline:
      "Gaps like these show up as revenue at risk, compliance exposure, and long nights reconciling what “should” have happened.",
    tensionBullets: [] as const,
    stakesBullets: [] as const,
  },
  mechanism: {
    intro: "Add this as a read-only gate in minutes:",
    items: homeHowItWorksSteps.map((s) => `${s.lead} ${s.body}`) as unknown as readonly [
      string,
      string,
      string,
    ],
    worksWith: bt.homepageCopy.mechanismWorksWith,
    notObservability: "It compares state to claims, not a full APM, distributed tracing, or log aggregation product.",
    quickPathDisclaimer: bt.verificationPaths.quickSqlOnlyDisclaimer,
  },
  homeClosing: {
    sectionTitle: "Ready to verify your first workflow?",
    subtitle: "Start with the bundled missing-write proof, then wire the same pattern into your own CI.",
  },
  forYou: [
    "You ship multi-step agents and care whether downstream store state matches the story in logs or traces",
    "You can emit (or are willing to add) structured tool output",
    "You have at least one queryable database, API, or file-backed store in the path",
  ] as const,
  notForYou: [
    "Unstructured log blobs with nothing to query as ground truth",
    "Replacing a full APM, tracing, or log analytics product end to end",
  ] as const,
} as const;

/** Deeper layer after the homepage: `/database-truth-vs-traces` (not in `config/marketing.json` word budget). */
export const productBriefPage = {
  metadata: {
    title: "How AgentSkeptic verifies reality",
    titleSuffix: "AgentSkeptic" as const,
    description:
      "Traces are not proof. Stored state is proof. Read-only verification returns a deterministic Outcome Certificate from your stores before release, billing, or continuation—bundled wf_complete and wf_missing examples included.",
  },
  jsonLdHeadline: "How AgentSkeptic verifies reality: read-only checks against stored state before ship, bill, or continue",
  testIds: {
    cta: "acquisition-cta-row" as const,
  },
  h1: "How AgentSkeptic verifies reality",
  /** Shown under H1, before `visitorProblemAnswer` from `config/marketing.json`. */
  mainHeadline: "Trust stored state, not trace success.",
  /** Placed after the `visitorProblemAnswer` block. */
  introParagraphs: [] as readonly string[],
  sections: [
    {
      id: "problem" as const,
      title: "The problem",
      paragraphs: [
        'The agent said "done."',
        "The trace turned green.",
        "The graph finished.",
        "But the customer record may still be missing, the ledger may be wrong, the vector may be stale, or the ticket may never have updated.",
        "Stored data is the source of truth.",
      ],
    },
    {
      id: "how" as const,
      title: "How read-only verification works",
      subheading: "The verification gate",
      intro: "One read-only gate turns agent claims into stored-state evidence:",
      steps: [
        "Emit structured tool activity for the actions and side effects you care about.",
        "Map tool IDs to real stores in a lightweight `tools.json` registry.",
        "Run verification against a read-only snapshot of your data.",
        "Get a structured Outcome Certificate with trust and remediation fields.",
      ],
      outro: "The check happens at verification time, against stored state — not from trace color.",
    },
  ],
  terminal: {
    beforeTitle: "Terminal proof: same claim, different reality",
    intro: [
      "The bundled `wf_complete` and `wf_missing` examples run through the same verification engine your own workflows use.",
    ],
  },
  disclaimer:
    "Important: read-only verification proves whether the expected state exists at verification time. It does not attribute causality to a specific tool call.",
  ctaSection: {
    title: "See proof, then verify",
    ariaLabel: "See a failed run, see a passed run, and run first verification",
    failed: { href: "/examples/wf-missing" as const, label: "See a failed run" as const },
    passed: { href: "/examples/wf-complete" as const, label: "See a passed run" as const },
    integrate: { href: "/integrate" as const, label: "Run first verification" as const },
  },
} as const;

export const productCopy = {
  links: {
    cliQuickstart: `${marketing.gitRepositoryUrl}#try-it-about-one-minute`,
    /** Relative to site origin — pair with NEXT_PUBLIC_APP_URL in prose docs. */
    openapiCommercial: "/openapi-commercial-v1.yaml",
    commercialPlansApi: "/api/v1/commercial/plans",
  },

  uiTestIds: {
    hero: "home-hero",
    homeWhatCatches: "home-what-catches",
    homeStakes: "home-stakes",
    howItWorks: "home-how-it-works",
    homeWhoFor: "home-who-for",
    homeGuarantees: "home-guarantees",
    homeClosing: "home-closing",
    tryIt: "home-try-it",
    commercialSurface: "home-commercial-surface",
    tryTruthReport: "try-truth-report",
    tryWorkflowJson: "try-workflow-json",
  },

  hero: {
    title: marketing.heroTitle,
    subtitle: marketing.heroSubtitle,
  },

  /** Post-condition / category line (SSOT: `config/marketing.json` `heroPositioning`). */
  heroPositioning: marketing.heroPositioning,
  /** Homepage hero: outcome line (SSOT: `config/marketing.json` `heroOutcome`). */
  heroOutcome: marketing.heroOutcome,
  /** Homepage hero: one-line mechanism. */
  heroMechanism: marketing.heroMechanism,
  homeValueProposition: homepageDisplay.homeValueProposition,
  /** Muted footnote under hero: read-only, non-causal; pair with on-site `How it works` link in page.tsx. */
  guaranteeFootnote: marketing.guaranteeFootnote,
  /** CTA for internal link on `guaranteeFootnote` (no raw GitHub URLs in hero). */
  guaranteeProductBriefCtaLabel: "How it works",

  /** Learn hub (`/guides`) first line under H1 (UI-only). */
  learnHubPrimaryLede: "Real failures. Stored-state fixes.",

  /** Guides hub second lede (UI-only). */
  guidesHubSupportingSentence:
    "Guides for proving that agent side effects actually landed before they reach production, billing, or customers.",

  /** Muted line after Learn hub supporting lede — pairs with `/compare`. */
  guidesHubCompareLead: "When you want bundles versus single checks in one view, use",

  /** Pairs with `/compare` (also used beside the detailed comparison table). */
  pricingCompareLead: "When you want bundles versus single checks in one view, use",

  /** Under pricing hero positioning — buyer commercial guide (fence-synced). */
  pricingBuyerCommercialBoundaryLinkLabel: "Buyer: commercial boundary and evaluation path",

  /** Indexable guide shell embed (UI-only). */
  indexedGuideEmbedTitle:
    "Example: activity that looked successful in logs or traces, missing row (ROW_ABSENT)",
  indexedGuideEmbedMuted:
    "The block below uses the bundled `wf_missing` demo so this page stays aligned with the engine.",

  /** Learn hub (`/guides`) metadata.description (UI-only). */
  learnHubIndexDescription:
    "Prove agent side effects in stored state before production, billing, or customers — practical guides and read-only verification gates.",

  /** Shared report view one-liner (UI-only). */
  publicShareReportIntro:
    "Private verification snapshot for sharing in tickets or Slack. This URL is not indexed for search; see Security & Trust for how the site handles data.",

  howItWorks: {
    sectionTitle: "How it works",
    acquisitionDepthLinkLabel: "How it works: traces and database",
    exampleWfMissingLabel: "Bundled ROW_ABSENT example",
    compareApproachesLabel: "Compare approaches",
  },

  /** `/problems` metadata (UI-only; list body comes from `config/marketing.json` `problemIndex`). */
  problemsPageMetadata: {
    title: "Problems AgentSkeptic catches",
    description:
      "Failure-mode index for trace-versus-state drift: pick the symptom that matches yours, then verify stored rows, CRM, CI side effects, pre-prod gates, LangGraph persistence, or Stripe ledgers before production.",
    supportingLine:
      "Pick the failure mode that looks like yours, then verify stored state before it reaches production, billing, or customers.",
  },

  homeWhatCatches: {
    sectionTitle: homepageDisplay.homeWhatCatches.sectionTitle,
    bullets: homepageDisplay.homeWhatCatches.bullets as unknown as readonly string[],
  },

  homeClosing: {
    sectionTitle: homepageDisplay.homeClosing.sectionTitle,
    subtitle: homepageDisplay.homeClosing.subtitle,
    integratorLinksCaption: "GitHub · npm · Docs · Pricing",
  },

  homeStakes: {
    sectionTitle: homepageDisplay.homeStakes.sectionTitle,
    stakesTagline: homepageDisplay.homeStakes.stakesTagline,
    tensionBullets: [...homepageDisplay.homeStakes.tensionBullets],
    stakesBullets: [...homepageDisplay.homeStakes.stakesBullets],
  },

  homeHeroExampleLabel: "Example: Missing write",
  homeHeroFailureCaptionLead:
    "The agent said the CRM contact was updated.",
  homeHeroFailureCaptionMid: "The database said otherwise.",
  homeHeroFailureCaptionOutro:
    "AgentSkeptic returned a failed verdict before the bug could ship.",

  fitAndLimits: {
    sectionTitle: "Who it's for",
    forYouHeading: "A strong fit when",
    notForYouHeading: "Not designed for",
  },
  homeGuarantees: {
    sectionTitle: "Guarantees and limitations",
  },

  homepageAcquisitionCta: {
    href: marketing.slug,
    label: marketing.homepageAcquisitionCtaLabel,
    testId: "homepage-acquisition-cta" as const,
  },

  productBriefPage,

  /** Security & Trust page — trust facts and documentation links. */
  securityTrust: {
    title: "Security & Trust",
    sections: [] as readonly { heading: string; paragraphs: readonly string[] }[],
    docLinks: {
      verificationSemanticsHref: bt.canonicalHref.verificationSemantics,
      commercialSsotHref: bt.canonicalHref.commercialSsotDoc,
    },
  },

  /** Primary outbound CTA on /guides/verify-langgraph-workflows (LangGraph reference README). */
  langgraphGuidePrimaryCtaLabel: "Open the LangGraph reference README (v3 emit, checkpoint-trust verify)",

  scenario: {
    title: "Concrete scenario",
    body: "A support tool reports “ticket closed” and the trace step is green. In the CRM database, the ticket row should be `status = resolved`. Verification compares that expectation to a real `SELECT`—not to the narrative.",
    beforeLabel: "Before",
    before: "You only see trace or tool success; you assume the row was written correctly.",
    afterLabel: "After",
    after: "You get a verdict from observed SQL: aligned with expectations, missing row, or wrong values—still at verification time, not proof of who wrote what.",
  },

  mechanism: {
    title: marketing.mechanism.title,
    intro: homepageDisplay.mechanism.intro,
    items: [...homepageDisplay.mechanism.items],
    worksWith: homepageDisplay.mechanism.worksWith,
    quickPathDisclaimer: homepageDisplay.mechanism.quickPathDisclaimer,
    notObservability: homepageDisplay.mechanism.notObservability,
  },

  forYou: homepageDisplay.forYou as unknown as readonly string[],

  notForYou: homepageDisplay.notForYou as unknown as readonly string[],

  guarantees: {
    title: "What you can count on",
    importantLimitationsTitle: "What it does not do",
    guaranteed: [
      "Read-only, deterministic checks — the engine never mutates your data.",
      "Verdicts you can script in the CLI, HTTP, and CI from the same inputs and a fixed registry.",
      "A schema-versioned outcome shape so you can treat results like test artifacts.",
    ],
    notGuaranteed: [
      "Causal attribution: AgentSkeptic verifies whether expected state exists; it does not prove which exact call created it.",
      "A substitute for the rest of your reliability stack; pair it with the logs, traces, and ownership you already run.",
    ],
  },

  tryIt: {
    title: "Interactive demo",
    intro: "Pick a scenario. The site runs the same open-source engine against bundled fixtures (no sign-in).",
    /** Shown above the run control so failures feel intentional, not random. */
    preButtonFraming: "Start with Missing write: green trace, missing row.",
    runButton: HOME_TRY_IT_RUN_BUTTON_LABEL,
    running: "Running…",
    scenarioLabel: "Scenario",
    /** Live region (polite) after a successful demo verification run. */
    a11ySuccessAnnouncement: "Verification finished. Verdict and details are below.",
    copyScenarioLinkButton: "Copy link to this scenario",
    shareReportButton: "Share report",
  },

  /** Account client: activation copy and a11y announcements (keep in sync with AccountClient UI). */
  account: {
    monthlyQuotaHeading: "Verification quota (this billing month)",
    monthlyQuotaKeyLine: (used: number, limitLabel: string) => `${used} used · included: ${limitLabel}`,
    monthlyQuotaUnlimited: "Unlimited",
    quotaUrgencyCopy: {
      ok: bt.accountQuotaUrgency.ok,
      notice: bt.accountQuotaUrgency.notice,
      warning: bt.accountQuotaUrgency.warning,
      in_overage: bt.accountQuotaUrgency.in_overage,
      at_cap: bt.accountQuotaUrgency.at_cap,
    },
    /** Shown instead of `quotaUrgencyCopy.ok` when there is no usage yet this month. */
    quotaUrgencyZeroUsage: bt.accountQuotaUrgency.zero_usage,
    a11yApiKeyReady: "API key generated. Copy it from the page and store it safely.",
    apiKeyRevealUrgentTitle: "Copy this now — you will not see the full key again after you leave this page.",
    apiKeyCopyButton: "Copy key",
    apiKeyCopyButtonCopied: "Copied",
    apiKeyCopyFallback: "Copy could not use the clipboard. Select the key above and copy manually (Ctrl+C / ⌘C).",
    checkoutActivationPending:
      "Finishing subscription setup… This usually takes a few seconds. You can refresh the page if it does not update.",
    checkoutActivationReady: "Your subscription is active. You can run paid verification with your API key.",
    checkoutActivationTimeout:
      "Still processing—refresh in a minute or contact the operator if this persists.",
    verificationHeadlineEmpty: "No verification activity yet",
    verificationHeadlineHasRows: "Recent verification activity",
    verificationHeadlineLoadFailed: "Activity did not load",
    verificationMetricLine: (n: number) => `This billing month (UTC): ${n} outcome${n === 1 ? "" : "s"} on record.`,
    verificationMonthNoRowsDetail:
      "We see activity for this billing month, but detailed rows are not available here yet—try refreshing in a moment.",
    activityLoadError:
      "We could not load verification activity right now. Refresh the page in a moment; if it keeps happening, contact support.",
    monthlyQuotaNoKeyLine: "No active API key yet. Create one below to use licensed verification.",
    primaryVerificationCtaFirstRun: "Run first verification",
    primaryVerificationCtaAgain: "Run first verification again",
    ossClaimChecklistTitle: "After linking a CLI verification",
    ossClaimChecklistItems: [
      "Your run id and outcome are attached to this account for verification history.",
      "Create an API key below if you need licensed npm verification or reserve quota.",
      "See site guides for environment setup and commands.",
    ] as const,
    ossClaimRunHint: (runId: string) => `Linked run id: ${runId.slice(0, 12)}…`,
    ossClaimStarterCta: "Compare paid plans for licensed verification and monthly allowance",
  },

  signInA11y: {
    sendEmailError: "Could not send sign-in email.",
    /** Shown when Resend rejects recipients while the sender is still `onboarding@resend.dev` (testing). */
    sendEmailResendTestingRecipients:
      "This site’s email is still in the provider’s testing mode, which only delivers magic links to the mailbox tied to that provider account. Ask the operator to verify a sending domain (and set EMAIL_FROM), or try a different email you already use with this site.",
    /** Shown when `from` uses a domain that is not verified in Resend. */
    sendEmailResendFromDomainUnverified:
      "The sign-in email could not be sent because the sender domain is not verified with the mail provider. The operator should verify the domain in Resend and set EMAIL_FROM to an address on that domain.",
    /** Too many magic-link send attempts for this email or IP in the current hour. */
    sendEmailRateLimited:
      "Too many sign-in emails were requested. Wait up to an hour and try again, or contact support if this keeps happening.",
    magicLinkSent: "Check your email for the sign-in link.",
  },

  /** One-word / short labels only: commercial prose comes from `commercialNarrative`. */
  homeCommercialCompareApproachesLabel: "Compare approaches" as const,

  pricingWhatYouGetPaidPlans,
  pricingHeroExample: pricingWhatYouGetPaidPlans,
  pricingPlansSectionTitle,
  pricingCommercialTermsDetailsSummary,
  pricingRecommendedPill,
  pricingTeamFootnote,
  pricingPlanCtas,

  ossClaimPage: {
    title: "Claim this run",
    introUnauthenticated:
      "Sign in with your email to connect this verification run to your account. OSS CLI account linking is opt-in: set AGENTSKEPTIC_OSS_CLAIM=1, run verify, then open the HTTPS link printed on stderr once before signing in (your magic link may open in a new tab).",
    signInCta: "Continue with email",
    redeeming: "Linking this run to your account…",
    pendingHandoffMissing:
      "We could not complete the account link automatically. Open the original claim link from your terminal again on this device, sign in when prompted, and stay on this site. If it has been more than 15 minutes, run verify again with AGENTSKEPTIC_OSS_CLAIM=1 to get a fresh link.",
    handoffInvalid:
      "This account link is not valid (expired, replaced, or mistyped). With CLI linking enabled (AGENTSKEPTIC_OSS_CLAIM=1), run verify again to print a fresh link, then open it once on this device.",
    handoffUsed:
      "This account link was already opened once. With CLI linking enabled, run verify again so the CLI can print a new link, then open that link once before signing in.",
    claimFailed:
      "This claim link could not be completed. With CLI linking enabled, run verify again to request a new link.",
    rateLimitedClaimPending:
      "Too many claim link opens from this network. Wait up to an hour and try again, or use a different connection.",
    rateLimitedRedeem: "Too many claim attempts for this account. Wait up to an hour and try again.",
    alreadyClaimed: "This run was already linked to a different account.",
    redeemedLead: "This run is linked to your account.",
    accountCta: "Go to account",
    runSummary: (r: { run_id: string; terminal_status: string }) =>
      `Run ${r.run_id.slice(0, 8)}… — outcome: ${r.terminal_status}`,
  },

  signInPurpose: {
    title: "Sign in",
    intro:
      "Use your email for a magic link to manage plans, account settings, and API keys.",
  },

  homeHeroCtaLabels,
  homeHeroSecondaryCta,
  homePageHeroIntegrateSecondaryLabel,
  homePageHeroSecondaryCta,
  ctaTaxonomy,
  coreValuePropTriptych,
  whenToUseDecisionBox,
  trustStripPills,
  homeHowItWorksSteps,
  homePageMissingWriteDemoCta: HOME_PAGE_MISSING_WRITE_DEMO_CTA,
  pricingBillingAndQuestionsBand,
  learnBundledProofLedes,
  learnBundledProofIntegrateLede,
  adoptionCompleteChecklistTokenRefs,

  /** One-line, human captions for `/guides` list items (nav labels stay discovery-stable). */
  learnGuideHubCaptions: {
    "/guides/verify-langgraph-workflows": "After a graph run, confirm the rows your tools claimed.",
    "/guides/trace-green-postgres-row-missing": "Agent trace looks fine; Postgres row is missing or wrong.",
    "/guides/tool-loop-success-crm-state-wrong": "Tool loop succeeded; CRM or SQLite state disagrees.",
    "/guides/ci-green-logs-row-absent": "CI passed on logs; the database write never showed up.",
    "/guides/pre-production-read-only-sql-gate": "A read-only gate before prod—not another log pipeline.",
    "/guides/ai-agent-wrong-crm-data": "Agent touched CRM; verify values before you trust the row.",
    "/guides/automation-success-database-mismatch": "Automation says done; persisted rows say otherwise.",
    "/guides/debug-postgres-after-langgraph": "Post-LangGraph debugging with row-level verification.",
    "/guides/stripe-webhook-database-alignment": "Webhook returned OK; ledger rows still need to match.",
    "/guides/ci-green-missing-database-side-effect": "Green CI while the side-effect row is still missing.",
    "/guides/first-run-verification": "Clone to crossing: run first-run verify on your own database.",
    "/guides/buyer-commercial-boundary": "Paid versus OSS boundaries and the evaluation path on this site.",
    "/guides/buyer-ci-enforcement-metering": "Locks, enforce, and reserve metering for CI pipelines.",
    "/guides/buyer-trust-production-implications": "What a green verdict means before you rely on it in production.",
  } as const satisfies Readonly<Record<string, string>>,

  /**
   * Hub-only link titles (`/guides` list). Discovery `navLabel` stays for routes, llms, and shells;
   * use this map to show calmer phrasing where the indexed title still reads search-shaped.
   */
  learnGuideHubLinkTitles: {
    "/guides/ai-agent-wrong-crm-data": "Wrong CRM data after an AI agent run",
    "/guides/automation-success-database-mismatch": "Automation succeeded; the database disagreed",
    "/guides/ci-green-missing-database-side-effect": "Green CI, missing database side effect",
    "/guides/ci-green-logs-row-absent": "CI passed on logs; the row never landed",
    "/guides/tool-loop-success-crm-state-wrong": "Tool loop says OK; CRM state does not match",
  } as const satisfies Readonly<Partial<Record<string, string>>>,

  supportPageMetadata,
  supportPage,
};
