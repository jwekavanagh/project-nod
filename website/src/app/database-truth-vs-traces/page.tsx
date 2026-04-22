import { DiscoveryArticleJsonLd } from "@/components/discovery/DiscoveryArticleJsonLd";
import { productBriefPage, productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Fragment } from "react";

const metaTitle = `${productBriefPage.metadata.title} — ${productBriefPage.metadata.titleSuffix}`;

export const metadata: Metadata = {
  title: metaTitle,
  description: productBriefPage.metadata.description,
  alternates: { canonical: indexableGuideCanonical(marketing.slug) },
  openGraph: {
    title: metaTitle,
    description: productBriefPage.metadata.description,
    type: "article",
  },
  robots: { index: true, follow: true },
};

function boldSegments(text: string): ReactNode {
  if (!text.includes("**")) {
    return text;
  }
  const parts = text.split("**");
  return parts.map((chunk, i) =>
    i % 2 === 1 ? <strong key={String(i) + chunk.slice(0, 8)}>{chunk}</strong> : <Fragment key={i}>{chunk}</Fragment>,
  );
}

export default function DatabaseTruthVsTracesPage() {
  const { visitorProblemAnswer, shareableTerminalDemo, heroSubtitle } = marketing;
  const pb = productBriefPage;
  const [sProblem, sHow, sScenarios, sWho] = pb.sections;

  return (
    <main className="integrate-main product-brief-page">
      <DiscoveryArticleJsonLd
        headline={pb.jsonLdHeadline}
        description={pb.metadata.description}
        path={marketing.slug}
      />
      <h1 data-testid="acquisition-hero-title">{pb.h1}</h1>
      <p className="lede">{heroSubtitle}</p>
      <div data-testid="visitor-problem-answer">
        {visitorProblemAnswer.split(/\n\n+/).filter(Boolean).map((p) => (
          <p key={p.slice(0, 64)} className="lede">
            {p}
          </p>
        ))}
      </div>
      {pb.introParagraphs.map((p) => (
        <p key={p.slice(0, 64)} className="lede product-brief-prose">
          {boldSegments(p)}
        </p>
      ))}

      <section className="home-section" data-testid="acquisition-brief-section-problem" aria-labelledby="brief-section-problem">
        <h2 id="brief-section-problem">{sProblem.title}</h2>
        {sProblem.paragraphs.map((p) => (
          <p key={p.slice(0, 64)} className="lede product-brief-prose">
            {boldSegments(p)}
          </p>
        ))}
      </section>

      <section className="home-section" data-testid="acquisition-brief-section-how" aria-labelledby="brief-section-how">
        <h2 id="brief-section-how">{sHow.title}</h2>
        <p className="lede product-brief-prose">{sHow.intro}</p>
        <ol className="product-brief-numbered">
          {sHow.steps.map((step) => (
            <li key={step.slice(0, 48)}>{boldSegments(step)}</li>
          ))}
        </ol>
      </section>

      <section
        className="home-section"
        data-testid="acquisition-brief-section-scenarios"
        aria-labelledby="brief-section-scenarios"
      >
        <h2 id="brief-section-scenarios">{sScenarios.title}</h2>
        <p className="lede product-brief-prose">{sScenarios.intro}</p>
        <ul className="product-brief-scenarios">
          {sScenarios.scenarios.map((row) => (
            <li key={row.name}>
              <h3 className="product-brief-scenario-name">{row.name}</h3>
              <p className="product-brief-prose">{boldSegments(row.body)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" data-testid="acquisition-brief-section-who" aria-labelledby="brief-section-who">
        <h2 id="brief-section-who">{sWho.title}</h2>
        <h3 className="guarantee-sub">{sWho.forYou.label}</h3>
        <ul>
          {sWho.forYou.items.map((t) => (
            <li key={t.slice(0, 48)}>{boldSegments(t)}</li>
          ))}
        </ul>
        <h3 className="guarantee-sub">{sWho.notForYou.label}</h3>
        <ul>
          {sWho.notForYou.items.map((t) => (
            <li key={t.slice(0, 48)}>{boldSegments(t)}</li>
          ))}
        </ul>
      </section>

      <section
        className="home-section"
        data-testid="acquisition-terminal-demo"
        aria-labelledby="terminal-narrative-heading"
      >
        <h2 id="terminal-narrative-heading">{pb.terminal.beforeTitle}</h2>
        {pb.terminal.intro.map((p) => (
          <p key={p.slice(0, 64)} className="lede product-brief-prose">
            {boldSegments(p)}
          </p>
        ))}
        <h3 className="muted product-brief-terminal-sub" id="terminal-demo-heading">
          {shareableTerminalDemo.title}
        </h3>
        <pre className="truth-report-pre" aria-labelledby="terminal-demo-heading">
          {shareableTerminalDemo.transcript}
        </pre>
      </section>

      <p className="muted product-brief-disclaimer" data-testid="acquisition-brief-disclaimer">
        {pb.disclaimer}
      </p>
      <div
        className="product-brief-cta-wrap"
        data-testid={pb.testIds.cta}
        role="group"
        aria-label="Get started and try the demo on the homepage"
      >
        <Link className="btn" href={productCopy.homeHeroSecondaryCta.href}>
          {productCopy.homeHeroSecondaryCta.label}
        </Link>{" "}
        <a className="btn secondary" href="/#try-it" data-testid="acquisition-try-home-demo-cta">
          {productCopy.homeHeroCtaLabels.demo}
        </a>
      </div>
    </main>
  );
}
