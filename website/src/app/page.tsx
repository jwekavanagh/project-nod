import { HeroTerminalHighlighted } from "@/components/HeroTerminalHighlighted";
import { TrustPills } from "@/components/marketing/TrustPills";
import { productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import type { Metadata } from "next";
import { shareableTerminalFailureJsonOnly } from "@/lib/shareableTerminalFailureExcerpt";
import {
  homeIndexPlainDescriptionFromMarketing,
  homePageTitleFromMarketing,
  marketingOpenGraphAndTwitter,
} from "@/lib/marketingSocialMetadata";
import { buildHomeClosingFooterLinks } from "@/lib/siteChrome";
import Link from "next/link";
import { Fragment } from "react";
import { HomeVerifyCta } from "./home/HomeVerifyCta";
import { HOME_SECTION_ORDER, type HomeSectionId } from "./page.sections";

const homePageTitle = homePageTitleFromMarketing(marketing.heroTitle);

const homeIndexMetadataDescription = homeIndexPlainDescriptionFromMarketing();

export const metadata: Metadata = {
  title: homePageTitle,
  description: homeIndexMetadataDescription,
  alternates: { canonical: indexableGuideCanonical("/") },
  ...marketingOpenGraphAndTwitter({
    title: homePageTitle,
    description: homeIndexMetadataDescription,
    openGraphType: "website",
  }),
};

const anchors = {
  gitRepositoryUrl: publicProductAnchors.gitRepositoryUrl,
  npmPackageUrl: publicProductAnchors.npmPackageUrl,
  bugsUrl: publicProductAnchors.bugsUrl,
};

export default async function HomePage() {
  const footerLinks = buildHomeClosingFooterLinks({ anchors });

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
            <p className="lede">{productCopy.heroMechanism}</p>
            <p className="home-cta-row" data-testid="home-hero-cta-row">
              <a
                className="btn"
                href="/verify"
                data-testid="home-hero-demo-cta"
                data-cta-priority="primary"
              >
                {productCopy.homePageMissingWriteDemoCta}
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
                {productCopy.homePageHeroIntegrateSecondaryLabel}
              </Link>
            </p>
            <TrustPills items={productCopy.trustStripPills} />
          </div>
          <div className="home-hero-terminal" data-testid="home-hero-terminal">
            <p className="muted home-hero-trace-bridge">
              Agent traces show what the agent attempted.
              <br />
              AgentSkeptic checks whether the promised state actually exists.
            </p>
            <p className="home-hero-terminal-label muted">{productCopy.homeHeroExampleLabel}</p>
            <p className="home-hero-failure-caption muted">
              {productCopy.homeHeroFailureCaptionLead}{" "}
              {productCopy.homeHeroFailureCaptionMid}{" "}
              {productCopy.homeHeroFailureCaptionOutro}
            </p>
            <p className="home-hero-verdict" aria-hidden="true">
              VERDICT: <span className="home-hero-verdict-failed">FAILED</span>
            </p>
            <div className="home-hero-flow" aria-label="Simplified missing-write flow">
              <div className="home-hero-flow-row">
                <span>Agent claimed</span>
                <span className="home-hero-flow-sep" aria-hidden="true">
                  →
                </span>
                <span>Store checked</span>
                <span className="home-hero-flow-sep" aria-hidden="true">
                  →
                </span>
                <span className="home-hero-flow-miss">Row missing</span>
              </div>
            </div>
            <div className="home-hero-example-json">
              <pre
                className="home-hero-terminal-pre"
                aria-label="Example verification failure JSON; verdict failed"
              >
                <HeroTerminalHighlighted text={heroFailureJson} />
              </pre>
            </div>
          </div>
        </div>
      </section>
    ),
    tryIt: <HomeVerifyCta key="tryIt" />,
    howItWorks: (
      <section
        key="howItWorks"
        className="home-section"
        data-testid={productCopy.uiTestIds.howItWorks}
        aria-labelledby="how-it-works-heading"
      >
        <h2 id="how-it-works-heading">{productCopy.howItWorks.sectionTitle}</h2>
        <ol className="mechanism-list home-how-tight">
          {productCopy.homeHowItWorksSteps.map((step) => (
            <li key={step.lead}>
              <strong>{step.lead}</strong>
              <br />
              {step.body}
            </li>
          ))}
        </ol>
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
        <p className="home-cta-row">
          <Link
            className="btn"
            href={productCopy.homeHeroSecondaryCta.href}
            data-testid="home-closing-primary-cta"
            data-cta-priority="primary"
          >
            {productCopy.homeHeroSecondaryCta.label}
          </Link>
        </p>
        <ul className="home-trust-strip-list">
          {footerLinks.map((item) => (
            <li key={item.key} data-testid={`home-footer-${item.key}`}>
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
  };

  return (
    <main>
      {HOME_SECTION_ORDER.map((id) => (
        <Fragment key={id}>{sectionRenderers[id]}</Fragment>
      ))}
    </main>
  );
}
