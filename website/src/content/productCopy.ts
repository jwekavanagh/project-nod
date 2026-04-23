/** Single source for homepage, pricing recap, sign-in framing, and test ids. */

import marketing from "@/lib/marketing";
import { METERING_CLARIFIER, SECURITY_QUICK_VS_CONTRACT_BULLET } from "@/content/marketingContracts";

export type InternalHref = "/security" | "/support" | "/pricing" | "/privacy" | "/terms" | "/integrate";

export type PricingTrustBandBeforeGrid = {
  title: string;
  paragraphs: readonly [string, string];
  links: readonly [{ label: string; href: "/security" }, { label: string; href: "/support" }];
};

export type SecurityQuickFacts = {
  title: string;
  bullets: readonly [string, string, string, string];
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

/** Hero primary CTA — scrolls to bundled Try it. */
export const HOME_HERO_DEMO_CTA_LABEL = "Try the demo (no account)" as const;

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
      cta: { label: "Go to Pricing", href: "/pricing" as const },
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
  primary: "See real verification outputs without running anything.",
  secondaryMuted:
    "These indexable examples mirror bundled workflows. Private paste links use /r/ and stay noindex by design.",
} as const satisfies LearnBundledProofLedes;

/** Bundled proof section on `/guides`: visible text split around the `/integrate` link. */
export const learnBundledProofIntegrateLede = {
  before: "For first-run on your own stores, follow ",
  after: " for Postgres or SQLite setup, registry shape, and CLI commands.",
} as const;

/** Curated Learn hub (`/guides`): benefit-led links; routes must match markdown `route` frontmatter. */
export const learnHub = {
  popularHeading: "Popular guides",
  debugHeading: "Debug & troubleshooting",
  buyersHeading: "For buyers & teams",
  bundledProofHeading: "Bundled proof examples",
  moreHeading: "More guides and scenarios",
  closingTitle: "Ready to try it on your data?",
  getStartedCtaLabel: "Get started",
  tryDemoCtaLabel: HOME_HERO_DEMO_CTA_LABEL,
  popular: [
    {
      href: "/guides/ai-agent-wrong-crm-data",
      title: "AI agent changed the CRM — but the row never landed",
      caption: "Verify values before you trust the customer record.",
    },
    {
      href: "/guides/scenario-green-trace-row-missing",
      title: "LangGraph trace looks healthy — but state is wrong",
      caption: "Catch missing or stale records after a graph run.",
    },
    {
      href: "/guides/scenario-ci-green-side-effect-missing",
      title: "CI passed, but the side effect is missing",
      caption: "Green logs do not mean your store actually updated.",
    },
    {
      href: "/guides/tool-loop-success-crm-state-wrong",
      title: 'Tool loop said "success" — CRM or ledger disagrees',
      caption: "Close the gap between declared activity and stored state.",
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
      title: "Debug Postgres or SQLite after LangGraph or agent runs",
      caption: "Read-only checks when traces and rows disagree.",
    },
    {
      href: "/guides/first-run-verification",
      title: "First-run verification on your own database",
      caption: "From clone to a real verify against your data.",
    },
    {
      href: "/guides/pre-production-read-only-sql-gate",
      title: "Pre-production read-only gate (not another log pipeline)",
      caption: "Add a gate from expected tool effects, not log volume.",
    },
  ],
  buyers: [
    {
      href: "/guides/buyer-ci-enforcement-metering",
      title: "CI enforcement and metering",
      caption: "Locks, enforcement, and usage for pipelines.",
    },
    {
      href: "/guides/buyer-commercial-boundary",
      title: "Commercial versus open-source boundaries",
      caption: "What is paid product, what stays OSS, and how to evaluate.",
    },
    {
      href: "/guides/buyer-trust-production-implications",
      title: "What a green verdict really means in production",
      caption: "Read the trust band before you rely on outcomes.",
    },
  ],
  exampleLinkLabels: {
    "/examples/wf-complete": "Verified workflow (wf_complete)",
    "/examples/wf-missing": "Failure with ROW_ABSENT (wf_missing)",
    "/examples/langgraph-checkpoint-trust": "LangGraph checkpoint trust (certificate example)",
  },
} as const;

export const pricingTrustBandBeforeGrid = {
  title: "Billing and plan changes",
  paragraphs: [
    "Subscribe with Stripe Checkout; manage cards, invoices, and upgrades from Account. Upgrade tiers as usage grows.",
    "Enterprise: use Contact sales on the Enterprise card for procurement, custom limits, or contract terms—do not use unpublished sales inboxes.",
  ],
  links: [
    { label: "Security & Trust", href: "/security" as const },
    { label: "Support", href: "/support" as const },
  ],
} as const satisfies PricingTrustBandBeforeGrid;

/** Above-the-fold `/pricing` hero (title, stakes, subhead) — from `config/marketing.json`. */
export const pricingHero = {
  title: marketing.site.pricing.heroTitle,
  positioning: marketing.site.pricing.positioning,
  subtitle: marketing.site.pricing.subtitle,
} as const;

export const pricingHeroExample = {
  title: "What you are buying",
  bullets: [
    "A workflow writes status = resolved.",
    "AgentSkeptic verifies that row in CI before deploy.",
    "If the database does not match, the build fails.",
  ],
} as const;

export const pricingRiskReassurance = "Cancel anytime; local verification stays free without a subscription.";

/** `/pricing` Starter card: `includedMonthly` is 0 (evaluation; no paid CLI allowance). */
export const pricingCardStarterPaidQuotaCaption =
  "No paid CLI quota—subscribe on Individual, Team, or Business for included monthly verifications.";

/** Truthful guidance without implying existing customer mix. */
export const pricingRecommendedPill = "For production CI";

/** Microcopy under Team card (upgrade trigger for shared CI). */
export const pricingTeamFootnote = "Upgrade when you enable CI enforcement.";

/** Primary CTA labels on `/pricing` cards (sign-in still required before checkout). */
export const pricingPlanCtas = {
  starter: { href: "/integrate" as const, label: "Start free" },
  individual: { signInLabel: "Get API key", checkoutLabel: "Continue to checkout" },
  team: { signInLabel: "Start using CI enforcement", checkoutLabel: "Continue to checkout" },
  business: { signInLabel: "Scale across services", checkoutLabel: "Continue to checkout" },
  enterprise: { label: "Contact sales" },
} as const;

export const securityQuickFacts = {
  title: "Quick facts for buyers",
  bullets: [
    "CLI and verification engine run in your infrastructure against databases you configure; the homepage demo runs bundled fixtures on this server for evaluation only.",
    "Structured tool activity is compared to database query results at verification time; that check does not prove a specific network call caused a row.",
    SECURITY_QUICK_VS_CONTRACT_BULLET,
    "For the on-site buyer trust summary, use the trust buyer guide on this site; full normative verification semantics stay in verification-product-ssot.md on GitHub.",
  ],
} as const satisfies SecurityQuickFacts;

export const homeHeroCtaLabels = {
  demo: HOME_HERO_DEMO_CTA_LABEL,
} as const satisfies HomeHeroCtaLabels;

/** Hero secondary CTA — distinct from nav “Product brief” (database-truth page). */
export const homeHeroSecondaryCta = {
  href: "/integrate" as const,
  label: "Get started",
  testId: "home-hero-get-started" as const,
} as const;

/** Deeper layer after the homepage: `/database-truth-vs-traces` (not in `config/marketing.json` word budget). */
export const productBriefPage = {
  metadata: {
    title: "Product brief",
    titleSuffix: "AgentSkeptic" as const,
    description:
      "The trace-vs-state gap, how read-only verification works (NDJSON, tools.json, verify run), what it catches, and the bundled wf_complete / wf_missing terminal outputs.",
  },
  jsonLdHeadline: "Product brief: read-only checks vs tool-claimed work on your stores",
  testIds: {
    cta: "acquisition-cta-row" as const,
  },
  h1: "Product brief",
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
    fitAndLimits: "home-fit-and-limits",
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

  /** Homepage hero: outcome line (SSOT: `config/marketing.json` `heroOutcome`). */
  heroOutcome: marketing.heroOutcome,
  /** Homepage hero: one-line mechanism. */
  heroMechanism: marketing.heroMechanism,
  /** Muted footnote under hero: read-only, non-causal; pair with on-site `Product brief` link in page.tsx. */
  guaranteeFootnote: marketing.guaranteeFootnote,
  /** CTA for internal link on `guaranteeFootnote` (no raw GitHub URLs in hero). */
  guaranteeProductBriefCtaLabel: "Product brief",

  /** Learn hub (`/guides`) first line under H1 (UI-only). */
  learnHubPrimaryLede: "Real problems, real fixes.",

  /** Guides hub second lede (UI-only). */
  guidesHubSupportingSentence:
    'Guides that turn "it looked fine in the trace" into "here is exactly what to check before it reaches production." Each short read links a common symptom to a concrete read-only verification you can add as a gate — then points you to Get started on your own data.',

  /** Muted line after Learn hub supporting lede — pairs with `/compare`. */
  guidesHubCompareLead: "When you want bundles versus single checks in one view, use",

  /** After pricing hero recap — pairs with `/compare`. */
  pricingCompareLead: "Compare plans to bundled proof paths when you are choosing an approach:",

  /** Under pricing hero positioning — buyer commercial guide (fence-synced). */
  pricingBuyerCommercialBoundaryLinkLabel: "Buyer: commercial boundary and evaluation path",

  /** Indexable guide shell embed (UI-only). */
  indexedGuideEmbedTitle:
    "Example: activity that looked successful in logs or traces, missing row (ROW_ABSENT)",
  indexedGuideEmbedMuted:
    "The block below uses the bundled `wf_missing` demo so this page stays aligned with the engine.",

  /** Learn hub (`/guides`) metadata.description (UI-only); includes bundled proof list. */
  learnHubIndexDescription:
    "Learn: symptom-led guides, read-only verification gates for your stores, and bundled public examples (wf_complete, wf_missing)—without private /r/ share links.",

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
    acquisitionDepthLinkLabel: "Product brief: traces vs database",
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
    sectionTitle: marketing.homeWhatCatches.sectionTitle,
    bullets: marketing.homeWhatCatches.bullets as unknown as readonly string[],
  },

  homeClosing: {
    sectionTitle: marketing.homeClosing.sectionTitle,
    subtitle: marketing.homeClosing.subtitle,
    integratorLinksCaption: "Docs & integration",
  },

  homeStakes: {
    sectionTitle: marketing.homeStakes.sectionTitle,
    stakesTagline: marketing.homeStakes.stakesTagline,
    tensionBullets: [...marketing.homeStakes.tensionBullets],
    stakesBullets: [...marketing.homeStakes.stakesBullets],
  },

  fitAndLimits: {
    sectionTitle: "Fit and limits",
    forYouHeading: "Who it's for",
    notForYouHeading: "Who it's not for",
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
      verificationProductSsot: `${marketing.gitRepositoryUrl}/blob/main/docs/verification-product-ssot.md`,
      commercialSsot: `${marketing.gitRepositoryUrl}/blob/main/docs/commercial-ssot.md`,
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
    intro: marketing.mechanism.intro,
    items: [...marketing.mechanism.items],
    notObservability: marketing.mechanism.notObservability,
  },

  forYou: marketing.buyerFit.forYou as unknown as readonly string[],

  notForYou: marketing.buyerFit.notForYou as unknown as readonly string[],

  guarantees: {
    title: "What is guaranteed (and what is not)",
    guaranteed: [
      "Verdicts use read-only checks against your stores at verification time, under your registry rules.",
      "Same inputs and store snapshot yield the same deterministic result shape (schema-versioned JSON).",
    ],
    notGuaranteed: [
      "Not proof a tool caused a specific write—only that observed state did or did not match expectations when checked.",
    ],
  },

  tryIt: {
    title: "Try it (no account)",
    intro: "Pick a bundled scenario. The server runs the same verification engine as the open-source CLI against demo fixtures.",
    introHeroEmbed: "Pick a scenario and run—the same verification engine as the open-source CLI, on bundled fixtures.",
    /** Shown above the run control so failures feel intentional, not random. */
    preButtonFraming:
      "Tip: use the missing write scenario (wf_missing)—`ROW_ABSENT` when the log implies a write the store does not show.",
    runButton: HOME_TRY_IT_RUN_BUTTON_LABEL,
    running: "Running…",
    scenarioLabel: "Scenario",
    /** Live region (polite) after a successful demo verification run. */
    a11ySuccessAnnouncement: "Verification finished. Human report and JSON are shown below.",
  },

  /** Account client: activation copy and a11y announcements (keep in sync with AccountClient UI). */
  account: {
    monthlyQuotaHeading: "Verification quota (this billing month)",
    monthlyQuotaYearMonth: (ym: string) => `Billing month: ${ym} (UTC).`,
    monthlyQuotaKeyLine: (used: number, limitLabel: string) =>
      `${used} used · limit: ${limitLabel}`,
    /** Starter plan: `includedMonthly` is 0; show reserve count without implying a paid allowance. */
    monthlyQuotaStarterKeyLine: (used: number) =>
      `${used} reservation event(s) this UTC month on this key · Starter has no included paid verification quota—subscribe from Pricing for licensed npm and monthly allowance.`,
    monthlyQuotaUnlimited: "Unlimited",
    monthlyQuotaDistinctDays: (n: number) => `Verification days this month: ${n}.`,
    /** Shown as `title` on the verification-days line (UTC / quota nuance). */
    monthlyQuotaDistinctDaysTitle:
      "Each count is a separate UTC calendar day this billing month when you ran paid verification against your allowance.",
    quotaUrgencyCopy: {
      ok: "Usage is comfortably below your plan limit.",
      notice: "You have used at least 75% of your included verifications for this month.",
      warning: "You have used at least 90% of your included verifications for this month.",
      at_cap: "You have reached your included verifications for this month. Upgrade or wait for the next billing month.",
    } as const,
    /** Starter: prior paid usage on key after downgrade—do not imply an active paid allowance. */
    quotaUrgencyStarterPriorUsage:
      "This key may show usage from a prior paid plan. Starter has no included paid verification quota—subscribe from Pricing to run licensed npm verification again.",
    /** Starter: activity signal without prior key usage (edge); still no paid allowance. */
    quotaUrgencyStarterNoIncludedQuota:
      "Starter does not include paid licensed verification quota. Subscribe from Pricing when you need API-keyed runs and a monthly allowance.",
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
    primaryVerificationCtaFirstRun: "Run your first verification",
    /** When the user has no key yet; verification CTA stays visible but sets expectations. */
    primaryVerificationCtaFirstRunNeedsKey: "Run your first verification (create a key below first)",
    primaryVerificationCtaAgain: "Run another verification",
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

  commercialSurface: {
    title: "What paid plans unlock",
    lead: METERING_CLARIFIER,
    /**
     * Homepage: outcome-focused, no license URLs; sign-in and contracts still use `lead` (METERING_CLARIFIER).
     */
    homeStrip:
      "Run verification in CI, enforce before deploy, and scale with included monthly quota. Local and open-source use stays free. In-process library use never calls the usage API.",
    compareApproachesLabel: "Compare approaches",
  },

  /** Retained for SSOT strings; `/pricing` renders `pricingHero` instead. */
  pricingRecap: pricingHero.subtitle,

  /** Retained for SSOT strings; `/pricing` uses `pricingHero.subtitle` in plan-choice testid slot. */
  pricingPlanChoiceGuide: pricingHero.subtitle,

  pricingHero,
  pricingHeroExample,
  pricingRiskReassurance,
  pricingCardStarterPaidQuotaCaption,
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
      "Use your email for a magic link. Signing in lets you subscribe to paid plans, manage your account, and generate API keys—not required for the homepage demo.",
    benefits: [
      "Subscribe to Individual, Team, or Business (Stripe Checkout; trial available on eligible plans)—required before licensed npm verify.",
      "Create and view API keys on the account page after sign-in.",
    ],
  },

  homeHeroCtaLabels,
  homeHeroSecondaryCta,
  pricingTrustBandBeforeGrid,
  securityQuickFacts,
  learnBundledProofLedes,
  learnBundledProofIntegrateLede,

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
