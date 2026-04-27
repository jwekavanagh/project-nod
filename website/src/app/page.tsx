import { HeroTerminalHighlighted } from "@/components/HeroTerminalHighlighted";
import { FunnelRouteCards } from "@/components/marketing/FunnelRouteCards";
import { TrustPills } from "@/components/marketing/TrustPills";
import { ValuePropTriptych } from "@/components/marketing/ValuePropTriptych";
import { WhenToUseDecisionBox } from "@/components/marketing/WhenToUseDecisionBox";
import { productCopy } from "@/content/productCopy";
import { siteMetadata } from "@/content/siteMetadata";
import marketing from "@/lib/marketing";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import type { Metadata } from "next";
import { shareableTerminalFailureJsonOnly } from "@/lib/shareableTerminalFailureExcerpt";
import {
  getHomeCommercialSectionFromConfig,
  HOME_COMMERCIAL_BOUNDARY_DOCS,
} from "@/lib/commercialNarrative";
import { buildHomeTrustStripLinks, openapiHrefFromProcessEnv } from "@/lib/siteChrome";
import { isDemoScenarioId, type DemoScenarioId } from "@/lib/demoScenarios";
import Link from "next/link";
import { Fragment, Suspense } from "react";
import { TryItSection } from "./home/TryItSection";
import { HOME_SECTION_ORDER, type HomeSectionId } from "./page.sections";

function resolveInitialTryItDemo(demo: string | string[] | undefined): DemoScenarioId {
  const s = Array.isArray(demo) ? demo[0] : demo;
  if (s && isDemoScenarioId(s)) return s;
  return "wf_missing";
}

export const metadata: Metadata = {
  title: marketing.siteDefaultMetadata.title,
  description: marketing.siteDefaultMetadata.description,
  alternates: { canonical: indexableGuideCanonical("/") },
  openGraph: {
    title: marketing.heroTitle,
    description: marketing.siteDefaultMetadata.description,
    type: "website",
    images: [
      {
        url: siteMetadata.openGraphImage.path,
        width: siteMetadata.openGraphImage.width,
        height: siteMetadata.openGraphImage.height,
        alt: siteMetadata.openGraphImage.alt,
      },
    ],
  },
};

const anchors = {
  gitRepositoryUrl: publicProductAnchors.gitRepositoryUrl,
  npmPackageUrl: publicProductAnchors.npmPackageUrl,
  bugsUrl: publicProductAnchors.bugsUrl,
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  const sp = await searchParams;
  const tryItInitial = resolveInitialTryItDemo(sp.demo);
  const homeCommercial = getHomeCommercialSectionFromConfig();
  const trustLinks = buildHomeTrustStripLinks({
    anchors,
    openapiHref: openapiHrefFromProcessEnv(),
  });

  const heroFailureJson = shareableTerminalFailureJsonOnly(
    marketing.shareableTerminalDemo.transcript,
  );

  const sectionRenderers: Record<HomeSectionId, React.ReactNode> = {
    hero: (
      <section
        key="hero"
        className="home-section home-hero"
        data-testid={productCopy.uiTestIds.hero}
        aria-labelledby="hero-heading"
      >
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <h1 id="hero-heading">{productCopy.hero.title}</h1>
            <p className="lede">{productCopy.heroOutcome}</p>
            <p className="lede home-hero-supporting-outcome">
              Catch missing DB writes before release with read-only verification against your actual
              stores.
            </p>
            <p className="home-cta-row" data-testid="home-hero-cta-row">
              <a
                className="btn"
                href="/?demo=wf_missing#try-it"
                data-testid="home-hero-demo-cta"
                data-cta-priority="primary"
              >
                {productCopy.ctaTaxonomy.topOfFunnel}
              </a>
            </p>
            <p className="muted home-hero-tertiary">
              <Link
                className="link-tertiary"
                href={productCopy.homePageHeroSecondaryCta.href}
                data-testid={productCopy.homePageHeroSecondaryCta.testId}
                data-cta-priority="secondary"
              >
                {productCopy.homePageHeroSecondaryCta.label}
              </Link>
              <span> · </span>
              <Link className="link-tertiary" href={productCopy.homeHeroSecondaryCta.href}>
                {productCopy.homeHeroSecondaryCta.label}
              </Link>
              <span> — npm, CI, and your own data.</span>
            </p>
            <TrustPills items={productCopy.trustStripPills} />
            <p className="muted" data-testid="home-guarantee-footnote">
              {productCopy.guaranteeFootnote}{" "}
              <Link href={marketing.slug} data-testid="home-guarantee-product-brief-link">
                {productCopy.guaranteeProductBriefCtaLabel}
              </Link>
              .
            </p>
          </div>
          <div className="home-hero-terminal" data-testid="home-hero-terminal">
            <p className="home-hero-terminal-label muted">{productCopy.homeHeroExampleLabel}</p>
            <p className="home-hero-failure-caption muted">{productCopy.homeHeroFailureCaption}</p>
            <p className="home-hero-verdict" aria-hidden="true">
              VERDICT: <span className="home-hero-verdict-failed">FAILED</span>
            </p>
            <div className="home-hero-flow" aria-label="Simplified missing-write flow">
              <div className="home-hero-flow-row">
                <span>Agent claimed</span>
                <span className="home-hero-flow-sep" aria-hidden="true">
                  →
                </span>
                <span>Store check</span>
                <span className="home-hero-flow-sep" aria-hidden="true">
                  →
                </span>
                <span className="home-hero-flow-miss">Row missing</span>
              </div>
            </div>
            <details className="home-hero-raw-json">
              <summary>Example verification details (JSON)</summary>
              <pre
                className="home-hero-terminal-pre"
                aria-label="Example verification failure JSON; verdict failed"
              >
                <HeroTerminalHighlighted text={heroFailureJson} />
              </pre>
            </details>
          </div>
        </div>
      </section>
    ),
    tryIt: (
      <Suspense key="tryIt" fallback={null}>
        <TryItSection initialScenarioId={tryItInitial} />
      </Suspense>
    ),
    homeWhatCatches: (
      <section
        key="homeWhatCatches"
        className="home-section home-what-catches"
        data-testid={productCopy.uiTestIds.homeWhatCatches}
        aria-labelledby="what-catches-heading"
      >
        <h2 id="what-catches-heading">{productCopy.homeWhatCatches.sectionTitle}</h2>
        <ValuePropTriptych
          problem={productCopy.coreValuePropTriptych.problem}
          solution={productCopy.coreValuePropTriptych.solution}
          outcome={productCopy.coreValuePropTriptych.outcome}
        />
        <ul>
          {productCopy.homeWhatCatches.bullets.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    ),
    homeStakes: (
      <section
        key="homeStakes"
        className="home-section"
        data-testid={productCopy.uiTestIds.homeStakes}
        aria-labelledby="home-stakes-heading"
      >
        <h2 id="home-stakes-heading">{productCopy.homeStakes.sectionTitle}</h2>
        <p className="lede home-stakes-tagline">{productCopy.homeStakes.stakesTagline}</p>
        {productCopy.homeStakes.tensionBullets.length > 0 ? (
          <ul className="home-stakes-tension">
            {productCopy.homeStakes.tensionBullets.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
        {productCopy.homeStakes.stakesBullets.length > 0 ? (
          <ul>
            {productCopy.homeStakes.stakesBullets.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
      </section>
    ),
    howItWorks: (
      <section
        key="howItWorks"
        className="home-section"
        data-testid={productCopy.uiTestIds.howItWorks}
        aria-labelledby="how-it-works-heading"
      >
        <h2 id="how-it-works-heading">{productCopy.howItWorks.sectionTitle}</h2>
        <p className="lede">{productCopy.mechanism.intro}</p>
        <ol className="mechanism-list home-how-tight">
          {productCopy.mechanism.items.map((item) => (
            <li key={item.slice(0, 48)}>{item}</li>
          ))}
        </ol>
        <p className="muted home-how-works-with">{productCopy.mechanism.worksWith}</p>
      </section>
    ),
    homeWhoFor: (
      <section
        key="homeWhoFor"
        className="home-section"
        data-testid={productCopy.uiTestIds.homeWhoFor}
        aria-labelledby="who-for-heading"
      >
        <div id="who-for-heading">
          <WhenToUseDecisionBox
            id="home-when-to-use-heading"
            title={productCopy.whenToUseDecisionBox.title}
            strongFitHeading={productCopy.whenToUseDecisionBox.strongFitHeading}
            notDesignedHeading={productCopy.whenToUseDecisionBox.notDesignedHeading}
            strongFitBullets={productCopy.whenToUseDecisionBox.strongFitBullets}
            notDesignedBullets={productCopy.whenToUseDecisionBox.notDesignedBullets}
          />
        </div>
      </section>
    ),
    homeGuarantees: (
      <section
        key="homeGuarantees"
        className="home-section"
        data-testid={productCopy.uiTestIds.homeGuarantees}
        aria-labelledby="guarantees-limits-heading"
      >
        <h2 id="guarantees-limits-heading">{productCopy.homeGuarantees.sectionTitle}</h2>
        <h3 className="home-guarantee-h2">{productCopy.guarantees.title}</h3>
        <ul>
          {productCopy.guarantees.guaranteed.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <h3 className="guarantee-sub">{productCopy.guarantees.importantLimitationsTitle}</h3>
        <ul>
          {productCopy.guarantees.notGuaranteed.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    ),
    homeClosing: (
      <section
        key="homeClosing"
        className="home-section home-closing"
        data-testid={productCopy.uiTestIds.homeClosing}
        aria-labelledby="home-closing-heading"
      >
        <h2 id="home-closing-heading">{productCopy.homeClosing.sectionTitle}</h2>
        <p className="lede">{productCopy.homeClosing.subtitle}</p>
        <p className="muted" data-testid="home-framework-maturity">
          {marketing.r2.frameworkMaturity}
        </p>
        <p className="muted home-closing-links-caption">{productCopy.homeClosing.integratorLinksCaption}</p>
        <FunnelRouteCards />
        <ul className="home-trust-strip-list">
          {trustLinks.map((item) => (
            <li key={item.key} data-testid={`home-trust-strip-${item.key}`}>
              {item.external ? (
                <a href={item.href} rel="noreferrer" target="_blank">
                  {item.label}
                </a>
              ) : (
                <a href={item.href}>{item.label}</a>
              )}
            </li>
          ))}
        </ul>
      </section>
    ),
    commercialSurface: (
      <section
        key="commercialSurface"
        className="home-section"
        data-testid={productCopy.uiTestIds.commercialSurface}
        aria-labelledby="commercial-surface-heading"
      >
        <h2 id="commercial-surface-heading">{homeCommercial.title}</h2>
        <p className="muted" data-testid="home-commercial-lead">
          {homeCommercial.lead}
        </p>
        <p className="muted" data-testid="home-commercial-boundary">
          <a
            className="link-tertiary"
            href={HOME_COMMERCIAL_BOUNDARY_DOCS.href}
            rel="noreferrer"
            target="_blank"
          >
            {HOME_COMMERCIAL_BOUNDARY_DOCS.label}
          </a>
        </p>
        <p className="commercial-links">
          <Link href="/pricing">Pricing</Link>
          {" · "}
          <Link href="/account">Account</Link>
          {" · "}
          <Link href="/compare">{productCopy.homeCommercialCompareApproachesLabel}</Link>
          {" · "}
          <a href={productCopy.links.openapiCommercial}>OpenAPI</a>
        </p>
      </section>
    ),
  };

  return (
    <main>
      {HOME_SECTION_ORDER.map((id) => (
        <Fragment key={id}>{sectionRenderers[id]}</Fragment>
      ))}
    </main>
  );
}
