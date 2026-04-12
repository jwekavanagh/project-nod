/** Single source for homepage, pricing recap, sign-in framing, and test ids. */

import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { publicProductAnchors } from "@/lib/publicProductAnchors";

export const productCopy = {
  links: {
    cliQuickstart: `${publicProductAnchors.gitRepositoryUrl}#try-it-about-one-minute`,
    /** Relative to site origin — pair with NEXT_PUBLIC_APP_URL in prose docs. */
    openapiCommercial: "/openapi-commercial-v1.yaml",
    commercialPlansApi: "/api/v1/commercial/plans",
  },

  uiTestIds: {
    hero: "home-hero",
    howItWorks: "home-how-it-works",
    fitAndLimits: "home-fit-and-limits",
    tryIt: "home-try-it",
    commercialSurface: "home-commercial-surface",
    tryTruthReport: "try-truth-report",
    tryWorkflowJson: "try-workflow-json",
  },

  hero: {
    title: discoveryAcquisition.heroTitle,
    subtitle: discoveryAcquisition.heroSubtitle,
  },

  /** Discovery SSOT: outcome framing before mechanism (`hero.subtitle`). */
  homepageHeroNarrative: {
    why: discoveryAcquisition.homepageHero.why,
    what: discoveryAcquisition.homepageHero.what,
    when: discoveryAcquisition.homepageHero.when,
  },

  howItWorks: {
    sectionTitle: "How it works",
  },

  fitAndLimits: {
    sectionTitle: "Fit and limits",
  },

  homepageAcquisitionCta: {
    href: discoveryAcquisition.slug,
    label: discoveryAcquisition.homepageAcquisitionCtaLabel,
    testId: "homepage-acquisition-cta" as const,
  },

  /** Primary nav label for the acquisition page (same `href` as homepage acquisition CTA). */
  navAcquisitionLabel: "Database truth vs traces",

  /** Shown once above the pricing grid; must stay aligned with commercial-ssot OSS path. */
  pricingOssPathReminder:
    "Contract verification from the open-source repo remains free without a subscription. The tiers below are for licensed npm usage, quota, and API keys on the commercial path.",

  /** Security & Trust page — factual only; link out to normative docs for guarantees. */
  securityTrust: {
    title: "Security & Trust",
    intro:
      "This page summarizes how the product and website handle data at a high level. Authoritative verification semantics and limits are in the linked documentation—not marketing paraphrase.",
    sections: [
      {
        heading: "Verification and read-only SQL",
        paragraphs: [
          "Verification compares structured tool activity to read-only `SELECT` results at verification time. It does not prove that a specific call caused a row. See the verification product SSOT for the trust boundary and vocabulary.",
        ],
      },
      {
        heading: "What runs in your environment",
        paragraphs: [
          "The open-source CLI and engine run in your infrastructure against databases you configure. The homepage demo runs bundled fixtures on the server for evaluation only.",
        ],
      },
      {
        heading: "Commercial surface",
        paragraphs: [
          "Licensed npm verification, quota, API keys, and billing are described in the commercial SSOT. Do not infer SLAs or certifications that are not explicitly published here.",
        ],
      },
      {
        heading: "Website, auth, and privacy",
        paragraphs: [
          "Account sign-in uses email magic links. See the Privacy Policy and Terms for data handling on this site.",
        ],
      },
    ],
    docLinks: {
      verificationProductSsot: `${publicProductAnchors.gitRepositoryUrl}/blob/main/docs/verification-product-ssot.md`,
      commercialSsot: `${publicProductAnchors.gitRepositoryUrl}/blob/main/docs/commercial-ssot.md`,
    },
  },

  /** `<details>` summary on /integrate for the full embedded integration guide. */
  integrateFullGuideSummary: "Full integration guide (prose SSOT — open when wiring semantics)",

  /** Shown above partner quickstart on /integrate. */
  integrateIntro:
    "Start with the command quickstart below, then open the full guide when you need semantics, guarantees, and common mistakes.",

  scenario: {
    title: "Concrete scenario",
    body: "A support tool reports “ticket closed” and the trace step is green. In the CRM database, the ticket row should be `status = resolved`. Verification compares that expectation to a real `SELECT`—not to the narrative.",
    beforeLabel: "Before",
    before: "You only see trace or tool success; you assume the row was written correctly.",
    afterLabel: "After",
    after: "You get a verdict from observed SQL: aligned with expectations, missing row, or wrong values—still at verification time, not proof of who wrote what.",
  },

  mechanism: {
    title: "Declared → Expected → Observed",
    items: [
      "Declared — what captured tool activity encodes (`toolId`, parameters).",
      "Expected — what should hold in SQL under your registry rules.",
      "Observed — what read-only queries returned at verification time.",
    ],
    notObservability:
      "This is not generic observability or log search. It is a deterministic comparison of expected state to live database reads—not proof that a specific API call caused a row.",
  },

  forYou: [
    "You emit structured tool activity (e.g. NDJSON) your pipeline can produce.",
    "You have SQL-accessible ground truth (SQLite, Postgres, or a mirror).",
    "You care when traces look fine but rows are wrong or missing.",
  ],

  notForYou: [
    "You only have unstructured logs and no SQL ground truth.",
    "You need causal proof that a particular call wrote a row.",
    "You want a generic APM or log analytics replacement.",
  ],

  guarantees: {
    title: "What is guaranteed (and what is not)",
    guaranteed: [
      "Verdicts are based on read-only SQL against your DB at verification time, under your registry rules.",
      "Same inputs and DB snapshot yield the same deterministic result shape (schema-versioned JSON).",
    ],
    notGuaranteed: [
      "Not proof that a tool executed, committed, or caused a row—only that state did or did not match expectations when checked.",
    ],
  },

  tryIt: {
    title: "Try it (no account)",
    intro: "Pick a bundled scenario. The server runs the same verification engine as the open-source CLI against demo fixtures.",
    runButton: "Run verification",
    running: "Running…",
    scenarioLabel: "Scenario",
  },

  commercialSurface: {
    title: "Commercial surface (what the product charges for)",
    lead:
      "Open-source lets you contract-verify from the repo without an API key; licensed npm usage, quota, and keys follow Pricing and Account. Machine-readable contracts stay on the site.",
  },

  pricingRecap:
    "You subscribe for licensed npm verification and higher monthly quota; OSS/source remains free for verify. Each tier states who it is for and what it unlocks.",

  pricingSignInCta: "Sign in to subscribe",

  signInPurpose: {
    title: "Sign in",
    intro:
      "Use your email for a magic link. Signing in lets you subscribe to paid plans, manage your account, and generate API keys—not required for the homepage demo.",
    benefits: [
      "Subscribe to Team or Business (Stripe Checkout; trial available)—required before licensed npm verify.",
      "Create and view API keys on the account page after sign-in.",
    ],
  },
};
