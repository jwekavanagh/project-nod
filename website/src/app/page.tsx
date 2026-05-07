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
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
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
              AgentSkeptic checks what actually changed.
            </p>
            <p className="home-hero-receipt-title">{productCopy.homeHeroReceipt.title}</p>
            <p className="home-hero-terminal-label muted">{productCopy.homeHeroExampleLabel}</p>
            <dl className="home-hero-receipt">
              <div className="home-hero-receipt-row">
                <dt className="home-hero-receipt-label">
                  {productCopy.homeHeroReceipt.rows.agentClaimLabel}
                </dt>
                <dd className="home-hero-receipt-value">
                  {productCopy.homeHeroReceipt.rows.agentClaim}
                </dd>
              </div>
              <div className="home-hero-receipt-row">
                <dt className="home-hero-receipt-label">
                  {productCopy.homeHeroReceipt.rows.realityLabel}
                </dt>
                <dd className="home-hero-receipt-value home-hero-receipt-value-fail">
                  {productCopy.homeHeroReceipt.rows.reality}
                </dd>
              </div>
              <div className="home-hero-receipt-row home-hero-verdict">
                <dt className="home-hero-receipt-label">
                  {productCopy.homeHeroReceipt.rows.verdictLabel}
                </dt>
                <dd className="home-hero-receipt-value">
                  <span className="home-hero-verdict-failed">
                    {productCopy.homeHeroReceipt.rows.verdictValue}
                  </span>
                </dd>
              </div>
              <div className="home-hero-receipt-row">
                <dt className="home-hero-receipt-label">
                  {productCopy.homeHeroReceipt.rows.ciResultLabel}
                </dt>
                <dd className="home-hero-receipt-value">
                  {productCopy.homeHeroReceipt.rows.ciResult}
                </dd>
              </div>
            </dl>
            <details className="home-hero-receipt-json">
              <summary className="home-hero-receipt-json-summary">
                {productCopy.homeHeroReceipt.jsonCaption}
              </summary>
              <div className="home-hero-example-json">
                <pre
                  className="home-hero-terminal-pre"
                  aria-label="Example verification failure JSON; verdict failed"
                >
                  <HeroTerminalHighlighted text={heroFailureJson} />
                </pre>
              </div>
            </details>
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
    <MarketingPageShell variant="home">
      {HOME_SECTION_ORDER.map((id) => (
        <Fragment key={id}>{sectionRenderers[id]}</Fragment>
      ))}
    </MarketingPageShell>
  );
}
