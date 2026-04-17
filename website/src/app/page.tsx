import { HeroTerminalHighlighted } from "@/components/HeroTerminalHighlighted";
import { productCopy } from "@/content/productCopy";
import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import { shareableTerminalFailureExcerpt } from "@/lib/shareableTerminalFailureExcerpt";
import { buildHomeTrustStripLinks, openapiHrefFromProcessEnv } from "@/lib/siteChrome";
import Link from "next/link";
import { Fragment } from "react";
import { TryItSection } from "./home/TryItSection";
import { HOME_SECTION_ORDER, type HomeSectionId } from "./page.sections";

const anchors = {
  gitRepositoryUrl: publicProductAnchors.gitRepositoryUrl,
  npmPackageUrl: publicProductAnchors.npmPackageUrl,
  bugsUrl: publicProductAnchors.bugsUrl,
};

function demoRepeatCta(testId: string) {
  return (
    <p className="home-repeat-cta">
      <a className="btn" href="#try-it" data-testid={testId}>
        {productCopy.homeHeroCtaLabels.demo}
      </a>
    </p>
  );
}

export default function HomePage() {
  const trustLinks = buildHomeTrustStripLinks({
    anchors,
    openapiHref: openapiHrefFromProcessEnv(),
  });

  const heroTerminalExcerpt = shareableTerminalFailureExcerpt(
    discoveryAcquisition.shareableTerminalDemo.transcript,
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
            <p className="lede">{productCopy.homepageDecisionFraming}</p>
            <p className="lede">{productCopy.homeHeroShortTagline}</p>
            <p className="lede home-moment-line">{productCopy.homeMomentLine}</p>
            <p className="home-cta-row" data-testid="home-hero-cta-row">
              <a className="btn" href="#try-it" data-testid="home-hero-demo-cta">
                {productCopy.homeHeroCtaLabels.demo}
              </a>
              <Link
                className="btn secondary"
                href={productCopy.homepageAcquisitionCta.href}
                data-testid={productCopy.homepageAcquisitionCta.testId}
              >
                {productCopy.homepageAcquisitionCta.label}
              </Link>
            </p>
          </div>
          <div className="home-hero-terminal" data-testid="home-hero-terminal">
            <p className="home-hero-terminal-label muted">Bundled demo output (failure)</p>
            <p className="home-hero-verdict" aria-hidden="true">
              VERDICT: <span className="home-hero-verdict-failed">FAILED</span>
            </p>
            <pre
              className="home-hero-terminal-pre"
              aria-label="Example verification failure transcript; verdict failed"
            >
              <HeroTerminalHighlighted text={heroTerminalExcerpt} />
            </pre>
          </div>
        </div>
        <TryItSection variant="heroEmbedded" />
      </section>
    ),
    homeWhatCatches: (
      <section
        key="homeWhatCatches"
        className="home-section home-what-catches"
        data-testid={productCopy.uiTestIds.homeWhatCatches}
        aria-labelledby="what-catches-heading"
      >
        <h2 id="what-catches-heading">{productCopy.homeWhatCatches.sectionTitle}</h2>
        <ul>
          {productCopy.homeWhatCatches.bullets.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {demoRepeatCta("home-repeat-cta-what-catches")}
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
        <ul className="home-stakes-tension">
          {productCopy.homeStakes.tensionBullets.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <ul>
          {productCopy.homeStakes.stakesBullets.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        {demoRepeatCta("home-repeat-cta-stakes")}
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
        <ol className="mechanism-list home-how-tight">
          {productCopy.mechanism.items.map((item) => (
            <li key={item.slice(0, 48)}>{item}</li>
          ))}
        </ol>
        <p className="muted">
          <Link href="/examples/wf-missing">{productCopy.howItWorks.exampleWfMissingLabel}</Link>
          {" · "}
          <Link href={discoveryAcquisition.slug}>{productCopy.howItWorks.acquisitionDepthLinkLabel}</Link>
          {" · "}
          <Link href="/security">Security & Trust</Link>
        </p>
        {demoRepeatCta("home-repeat-cta-how-it-works")}
      </section>
    ),
    fitAndLimits: (
      <section
        key="fitAndLimits"
        className="home-section"
        data-testid={productCopy.uiTestIds.fitAndLimits}
        aria-labelledby="fit-limits-heading"
      >
        <h2 id="fit-limits-heading">{productCopy.fitAndLimits.sectionTitle}</h2>
        <h3>For you</h3>
        <ul>
          {productCopy.forYou.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <h3>Not for you</h3>
        <ul>
          {productCopy.notForYou.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <h3 className="guarantee-sub">Guaranteed</h3>
        <ul>
          {productCopy.guarantees.guaranteed.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <h3 className="guarantee-sub">Not guaranteed</h3>
        <ul>
          {productCopy.guarantees.notGuaranteed.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="muted">{productCopy.mechanism.notObservability}</p>
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
        {demoRepeatCta("home-repeat-cta-closing")}
        <p className="muted home-closing-links-caption">{productCopy.homeClosing.integratorLinksCaption}</p>
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
        <h2 id="commercial-surface-heading">{productCopy.commercialSurface.title}</h2>
        <p>{productCopy.commercialSurface.lead}</p>
        <p className="commercial-links">
          <Link href="/pricing">Pricing</Link>
          {" · "}
          <Link href="/account">Account</Link>
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
