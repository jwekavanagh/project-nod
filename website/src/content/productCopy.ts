/** Single source for most site chrome, a11y, and test ids. Public commercial + contract copy lives in `@/lib/commercialNarrative` + `config/commercial-plans.json`. */

import marketing from "@/lib/marketing";

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
  | "See a failed vs passed run"
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
    "AgentSkeptic is the commercial product surface for a read-only SQL verification engine shipped as open source from the same repository.",
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
  popularHeading: "Guides",
  debugHeading: "Debug & troubleshooting",
  buyersHeading: "For buyers and teams",
  bundledProofHeading: "Bundled proof examples",
  closingTitle: "Ready to try it on your data?",
  getStartedCtaLabel: "Get started",
  tryDemoCtaLabel: HOME_HERO_DEMO_CTA_LABEL,
  popular: [
    {
      href: "/guides/ai-agent-wrong-crm-data",
      title: "AI agent updated the CRM — but the record never landed",
      caption: "Verify values before you trust the customer data.",
    },
    {
      href: "/guides/scenario-green-trace-row-missing",
      title: "LangGraph trace looks healthy — but state is wrong",
      caption: "Catch missing or stale records and vectors after a graph run.",
    },
    {
      href: "/guides/scenario-ci-green-side-effect-missing",
      title: "CI passed, but the side effect is missing",
      caption: "Green logs don't mean your store updated.",
    },
    {
      href: "/guides/tool-loop-success-crm-state-wrong",
      title: 'Tool loop said "success" — CRM or ledger disagrees',
      caption: "Close the gap between declared activity and stored state.",
    },
    {
      href: "/guides/scenario-stripe-webhook-ledger-mismatch",
      title: "Stripe webhook returned 200 — but your ledger is off",
      caption: "Reconcile external callbacks with your internal records before settlement.",
    },
  ],
  debug: [
    {
      href: "/guides/debug-postgres-after-langgraph",
      title: "Debug after LangGraph or agent runs (Postgres, SQLite, and other stores)",
      caption: "A practical checklist to reconcile traces with persisted rows and state.",
    },
    {
      href: "/guides/first-run-verification",
      title: "First-run verification on your own data",
      caption: "Run the first deterministic check on your own stores with minimal setup.",
    },
    {
      href: "/guides/pre-production-read-only-sql-gate",
      title: "Add a pre-production read-only gate (instead of more log volume)",
      caption: "Add a stop-ship gate that verifies state before release.",
    },
  ],
  buyers: [
    {
      href: "/guides/buyer-ci-enforcement-metering",
      title: "CI enforcement and metering",
      caption: "Understand enforcement controls, reserve behavior, and quota planning.",
    },
    {
      href: "/guides/buyer-commercial-boundary",
      title: "Commercial vs open-source boundaries and evaluation path",
      caption: "See exactly what is paid vs OSS and how to evaluate without ambiguity.",
    },
    {
      href: "/guides/buyer-trust-production-implications",
      title: "What a green verdict really means in production",
      caption: "Interpret trust outcomes correctly and avoid over-claiming guarantees.",
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
    "Run verification in CI and automatically fail builds on mismatch",
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
    "See a failed vs passed run",
    "Run on sample data in 5 minutes",
    "Run first verification",
    "Start free",
    "Continue to checkout",
    "Sign in to continue",
    "Continue with email",
    "View pricing",
  ] as const,
  dominantByRoute: {
    "/": "Try interactive demo",
    "/database-truth-vs-traces": "See a failed vs passed run",
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

/** Homepage hero secondary: docs hub; primary remains Try the demo. */
export const homePageHeroSecondaryCta = {
  href: "/guides" as const,
  label: "Read the docs",
  testId: "home-hero-read-docs" as const,
} as const;

export const ctaTaxonomy = {
  awareness: "See a failed vs passed run",
  topOfFunnel: "Try interactive demo",
  consideration: "Run on sample data in 5 minutes",
  decision: "Run first verification",
  decisionAlternative: "Start free",
} as const;

export const coreValuePropTriptych = {
  problem: "Agents can report success while data is wrong.",
  solution: "Read-only verification against your actual stores.",
  outcome: "Prevent false-green releases.",
} as const;

export const whenToUseDecisionBox = {
  title: "When to use AgentSkeptic",
  strongFitHeading: "Strong fit",
  notDesignedHeading: "Not designed for",
  strongFitBullets: [
    "You need a release gate that verifies stored state, not just logs.",
    "You already have queryable stores (SQL, APIs, vectors, object storage).",
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
  "Read-only by default",
  "No production writes",
  "Audit-friendly outputs",
] as const;

/**
 * Primary homepage copy (canonical for `/`). Stubs for the same topics remain in
 * `config/marketing.json` for the prose budget; the site renders this object instead.
 */
const homepageDisplay = {
  homeValueProposition:
    "AgentSkeptic compares agent claims with real downstream state — databases, APIs, object stores, and vector stores — and returns a clear verdict. Read-only, deterministic, and CI-friendly.",
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
    items: [
      "Agents emit structured tool activity (JSON/NDJSON) as they work.",
      "You map tool ids to the stores they touch (for example in tools.json).",
      "Verification re-reads those stores and returns a deterministic outcome you can script in CI and HTTP.",
    ] as const,
    worksWith:
      "Postgres, SQLite, MongoDB, S3, HTTP APIs, vector stores, and other queryable systems.",
    notObservability: "It compares state to claims, not a full APM, distributed tracing, or log aggregation product.",
  },
  homeClosing: {
    sectionTitle: "Ready to try?",
    subtitle: "Run the linked demo, skim the guides, then follow Get started on your own data.",
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
    title: "How it works",
    titleSuffix: "AgentSkeptic" as const,
    description:
      "Read-only verification: how your agents' claims are checked against real database and API state, the trace versus state gap, and bundled demo output.",
  },
  jsonLdHeadline: "How it works: read-only checks for tool-claimed work on your stores",
  testIds: {
    cta: "acquisition-cta-row" as const,
  },
  h1: "How it works",
  /** Placed after the `visitorProblemAnswer` block. */
  introParagraphs: [
    "This page shows the complete picture: why the gap matters in production, how verification works in one simple gate, what real failures it catches, and the exact success/failure outputs your own runs will produce.",
  ],
  sections: [
    {
      id: "problem" as const,
      title: "The problem",
      paragraphs: [
        "Agents and workflows look successful in traces and logs. The tool reported “done.” The step completed. The graph finished.",
        "Yet the customer record is missing, the ledger is off, the vector is stale, or the ticket never updated.",
        "Traces stop at “the tool said it worked.”",
        "Your stored data is what actually matters — and that’s exactly where silent failures hide.",
      ],
    },
    {
      id: "how" as const,
      title: "How read-only verification works",
      intro: "One simple gate you control:",
      steps: [
        "Emit structured tool activity (usually NDJSON) for the actions and side effects you care about.",
        "Map those tool IDs to your real stores in a lightweight `tools.json` registry.",
        "Run verification against a read-only snapshot of your data.",
      ],
      outro:
        "You get a clear JSON outcome and human-readable report — or a non-zero exit code. The check happens at verification time, not from trace color.",
    },
    {
      id: "scenarios" as const,
      title: "What it catches in production",
      bullets: [
        "**LangGraph and agent workflows**: The trace looks healthy, but the persisted row or vector is missing or wrong at handoff.",
        "**CRM and ticket systems**: The agent says the ticket is closed, but the CRM still shows the old state or the record never landed.",
        "**CI and deploy gates**: Pipelines pass on logs, but the required side effect never appeared in the target store.",
        "**Webhooks and ledgers** (Stripe-style flows): The external callback succeeded, but your internal ledger or reconciliation is inconsistent.",
      ],
      coda: "These are not “trace lies” — they are gaps between what was declared and what actually exists when it matters.",
    },
    {
      id: "who" as const,
      title: "Who it's for (and who it's not)",
      forYou: {
        label: "Use AgentSkeptic when",
        items: [
          "You emit structured tool output.",
          "You have queryable stores (SQL, vectors, S3, Mongo, HTTP-accessible data, and similar).",
          "You've seen green traces that still left bad or missing data behind.",
        ],
      },
      notForYou: {
        label: "Not the right fit when",
        items: [
          "You only have unstructured logs with nothing to query.",
          "You need proof that one specific call caused a write.",
          "You're looking for a full APM or log analytics replacement.",
        ],
      },
    },
  ],
  terminal: {
    beforeTitle: "Terminal proof: success vs failure",
    intro: [
      "Here are the exact outputs from the bundled demo (`wf_complete` and `wf_missing`). Your own runs use the same verification engine.",
    ],
  },
  disclaimer: "**Read-only at verification time** — not proof of which call caused a specific write.",
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
  learnHubPrimaryLede: "Real problems, real fixes.",

  /** Guides hub second lede (UI-only). */
  guidesHubSupportingSentence:
    `Guides that turn "it looked fine in the trace" into "here's exactly what to check before it reaches production."`,

  /** Learn hub third lede — gate + Get started (UI-only). */
  guidesHubBridgeSentence:
    "Each short read connects a common symptom to a read-only verification you can add as a gate — then sends you straight to Get started on your own data.",

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

  /** Learn hub (`/guides`) metadata.description (UI-only); includes bundled proof list. */
  learnHubIndexDescription:
    "Symptom-led guides, read-only verification gates for your stores, bundled examples you can skim, and a clear path to Get started.",

  /** Shared report view one-liner (UI-only). */
  publicShareReportIntro:
    "Private verification snapshot for sharing in tickets or Slack. This URL is not indexed for search; see Security & Trust for how the site handles data.",

  /** Server intro on `/account` (AccountServerAboveFold); links are composed in TSX. */
  accountPage: {
    line1: "Recent verification runs, your plan and usage, and API keys—together in one place.",
    pricingLinkLabel: "Pricing",
    integrateLinkLabel: "Get started",
  } as const,

  howItWorks: {
    sectionTitle: "How it works",
    acquisitionDepthLinkLabel: "How it works: traces and database",
    exampleWfMissingLabel: "Bundled ROW_ABSENT example",
    compareApproachesLabel: "Compare approaches",
  },

  /** `/problems` metadata (UI-only; list body comes from `config/marketing.json` `problemIndex`). */
  problemsPageMetadata: {
    title: "Problems the product routes to — AgentSkeptic",
    description:
      "Buyer moments from `config/marketing.json` `problemIndex`—each row links to a guide and related site paths.",
  },

  /** Visible text around the `/compare` link on `/problems`. */
  problemsHubIntroLead:
    "These buyer moments are published in discovery order; each row links to a primary guide and related paths on this site. When you want bundles versus single checks in one place, use",

  problemsHubIntroTrail: ".",

  homeWhatCatches: {
    sectionTitle: homepageDisplay.homeWhatCatches.sectionTitle,
    bullets: homepageDisplay.homeWhatCatches.bullets as unknown as readonly string[],
  },

  homeClosing: {
    sectionTitle: homepageDisplay.homeClosing.sectionTitle,
    subtitle: homepageDisplay.homeClosing.subtitle,
    integratorLinksCaption: "GitHub · npm · OpenAPI · documentation",
  },

  homeStakes: {
    sectionTitle: homepageDisplay.homeStakes.sectionTitle,
    stakesTagline: homepageDisplay.homeStakes.stakesTagline,
    tensionBullets: [...homepageDisplay.homeStakes.tensionBullets],
    stakesBullets: [...homepageDisplay.homeStakes.stakesBullets],
  },

  homeHeroExampleLabel: "Example: Missing write",
  homeHeroFailureCaption:
    "The agent reported a successful CRM contact update, but the row is missing from the database.",

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

  /** Security & Trust page — factual only; link out to normative docs for guarantees. */
  securityTrust: {
    title: "Security & Trust",
    intro: "Buyer-oriented answers live on this site first; GitHub remains the full normative source.",
    sections: [
      {
        heading: "Buyer answers on this site",
        paragraphs: [
          "Use the buyer guides, Problems index, and Compare hub linked above for evaluation, metering, and trust boundaries in site-native prose before you widen database access.",
        ],
      },
      {
        heading: "GitHub as authoritative documentation",
        paragraphs: [
          "Verification vocabulary, commercial limits, and incident-class semantics remain normative in the repository SSOT documents linked below—this page does not restate those contracts.",
        ],
      },
    ],
    docLinks: {
      verificationProductSsot: `${marketing.gitRepositoryUrl}/blob/main/docs/verification-product.md`,
      commercialSsot: `${marketing.gitRepositoryUrl}/blob/main/docs/commercial.md`,
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
    monthlyQuotaYearMonth: (ym: string) => `Billing month: ${ym} (UTC).`,
    monthlyQuotaKeyLine: (used: number, limitLabel: string) =>
      `${used} used · included: ${limitLabel} (UTC month)`,
    monthlyQuotaUnlimited: "Unlimited",
    monthlyQuotaDistinctDays: (n: number) => `Verification days this month: ${n}.`,
    /** Shown as `title` on the verification-days line (UTC / quota nuance). */
    monthlyQuotaDistinctDaysTitle:
      "Each count is a separate UTC calendar day this billing month when you ran paid verification against your allowance.",
    quotaUrgencyCopy: {
      ok: "Usage is comfortably below your included verifications (per API key) for this month.",
      notice: "You have used at least 75% of your included verifications (per key) for this month.",
      warning: "You have used at least 90% of your included verifications, or you are at the top of the included amount before overage.",
      in_overage:
        "You are past the included amount on at least one key. Metered overage is billed; see the estimate above and your Stripe invoice.",
      at_cap: "You have reached the hard cap (Starter) or a limit that blocks new runs. Upgrade or wait for the next month.",
    } as const,
    /** Shown instead of `quotaUrgencyCopy.ok` when there is no usage yet this month. */
    quotaUrgencyZeroUsage: "No verification usage recorded for this billing month yet.",
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
    activityEmpty:
      "Nothing recorded for this billing month yet. Create a key below if you need one—the Integrate button is your next step.",
    activityLoadError:
      "We could not load verification activity right now. Refresh the page in a moment; if it keeps happening, contact support.",
    trustFootnoteLines: [
      "Billing and subscription details are managed through Stripe; use Manage billing when it appears above.",
      "How keys and data are handled is summarized on the Security & Trust page—this page does not add new guarantees beyond that page.",
    ] as const,
    starterUpgradeBody:
      "Starter is for trying the product. Paid plans unlock real verification runs, predictable monthly usage, and checks you can rely on in CI and production—not just demos.",
    monthlyQuotaNoKeyLine:
      "No active API key yet. Create one below, add it to your environment, then run a verification from Integrate.",
    apiKeyFlowHeading: "Turn your key into a run",
    apiKeyFlowSteps: [
      "Generate an API key below (one-time reveal—copy it immediately).",
      "Set AGENTSKEPTIC_API_KEY in your environment (WORKFLOW_VERIFIER_API_KEY still works).",
      "Open Integrate and run npx agentskeptic verify … from your repo (full commands are on that page).",
    ] as const,
    primaryVerificationCtaFirstRun: "Run first verification",
    /** When the user has no key yet; verification CTA stays visible but sets expectations. */
    primaryVerificationCtaFirstRunNeedsKey: "Run first verification (create a key below first)",
    primaryVerificationCtaAgain: "Run first verification again",
    ossClaimChecklistTitle: "After linking a CLI verification",
    ossClaimChecklistItems: [
      "Your run id and outcome are attached to this account for verification history.",
      "Create an API key below if you need licensed npm verification or reserve quota.",
      "Use Integrate for copy-paste commands tied to your environment.",
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
      "Sign in with your email to connect this verification run to your account. Open the HTTPS claim link printed on stderr after verify (one navigation registers the handoff); then sign in when prompted (your magic link may open in a new tab).",
    signInCta: "Continue with email",
    redeeming: "Linking this run to your account…",
    pendingHandoffMissing:
      "We could not complete the account link automatically. Open the original claim link from your terminal again on this device, sign in when prompted, and stay on this site. If it has been more than 15 minutes, run your verification again to get a fresh link.",
    handoffInvalid:
      "This account link is not valid (it may have expired, been replaced by a newer link, or mistyped). Run verify again in your terminal to print a fresh link, then open it once on this device.",
    handoffUsed:
      "This account link was already opened once. Run verify again (or repeat the claim step from your terminal) so the CLI can print a new link, then open that link once before signing in.",
    claimFailed: "This claim link could not be completed. Request a new link by running the CLI again.",
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
    benefits: [
      "Subscribe to Individual, Team, or Business (Stripe Checkout; trial available on eligible plans)—required before licensed npm verify.",
      "Create and view API keys on the account page after sign-in.",
    ],
  },

  homeHeroCtaLabels,
  homeHeroSecondaryCta,
  homePageHeroSecondaryCta,
  ctaTaxonomy,
  coreValuePropTriptych,
  whenToUseDecisionBox,
  trustStripPills,
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
