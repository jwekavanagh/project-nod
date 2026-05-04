import { DiscoveryArticleJsonLd } from "@/components/discovery/DiscoveryArticleJsonLd";
import { conversionSpine, productBriefPage, productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";
import { type ReactNode, Fragment } from "react";

const acquisitionSegmentTitle = productBriefPage.metadata.title;
const metaTitle = `${productBriefPage.metadata.title} — ${productBriefPage.metadata.titleSuffix}`;

export const metadata: Metadata = {
  title: acquisitionSegmentTitle,
  description: productBriefPage.metadata.description,
  alternates: { canonical: indexableGuideCanonical(marketing.slug) },
  ...marketingOpenGraphAndTwitter({
    title: metaTitle,
    description: productBriefPage.metadata.description,
    openGraphType: "article",
  }),
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

/** Splits the bundled `shareableTerminalDemo.transcript` at the failure heading—verbatim engine output. */
function splitDemoSuccessFailure(transcript: string): { success: string; failure: string } {
  const needle = "\n\n### Failure (`wf_missing`)";
  const i = transcript.indexOf(needle);
  if (i < 0) {
    throw new Error("splitDemoSuccessFailure: missing Failure block in shareable terminal transcript");
  }
  return {
    success: transcript.slice(0, i).trim(),
    failure: transcript.slice(i + needle.length).trim(),
  };
}

/** Drop markdown H3 lines duplicated by on-page `<h3>` titles above each `<pre>`. */
function stripBundledTerminalHeadingsForDisplay(success: string, failure: string): { success: string; failure: string } {
  const s = success.replace(/^### Success \(`wf_complete`\)\s*\n+/, "").trimStart();
  const f = failure.replace(/^### Failure \(`wf_missing`\)\s*\n+/, "").trimStart();
  return { success: s, failure: f };
}

export default function DatabaseTruthVsTracesPage() {
  const { visitorProblemAnswer, shareableTerminalDemo, heroTitle } = marketing;
  const pb = productBriefPage;
  const [sProblem, sHow] = pb.sections;
  const { success: rawSuccess, failure: rawFailure } = splitDemoSuccessFailure(shareableTerminalDemo.transcript);
  const { success: successBlock, failure: failureBlock } = stripBundledTerminalHeadingsForDisplay(rawSuccess, rawFailure);
  if (sProblem.id !== "problem" || sHow.id !== "how") {
    throw new Error("How it works page sections: expected problem then how");
  }

  return (
    <main className="integrate-main product-brief-page">
      <DiscoveryArticleJsonLd
        headline={pb.jsonLdHeadline}
        description={pb.metadata.description}
        path={marketing.slug}
      />
      <h1 data-testid="acquisition-hero-title">{pb.h1}</h1>
      <p className="lede product-brief-tagline">{heroTitle}</p>
      <div data-testid="visitor-problem-answer">
        {visitorProblemAnswer.split(/\n\n+/).filter(Boolean).map((p) => (
          <p key={p.slice(0, 64)} className="lede">
            {p}
          </p>
        ))}
      </div>
      {pb.introParagraphs.map((p) => (
        <p key={p.slice(0, 64)} className="lede product-brief-prose">
          {p}
        </p>
      ))}

      <section className="home-section" data-testid="acquisition-brief-section-problem" aria-labelledby="brief-section-problem">
        <h2 id="brief-section-problem">{sProblem.title}</h2>
        {sProblem.paragraphs.map((p) => (
          <p key={p.slice(0, 64)} className="lede product-brief-prose">
            {p}
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
        <p className="lede product-brief-prose">{sHow.outro}</p>
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
        <h3 className="product-brief-terminal-block-title" id="terminal-success-heading">
          Success (`wf_complete`)
        </h3>
        <pre className="truth-report-pre" aria-labelledby="terminal-success-heading">
          {successBlock}
        </pre>
        <h3 className="product-brief-terminal-block-title" id="terminal-failure-heading">
          Failure (`wf_missing`) — <span className="product-brief-row-absent">ROW_ABSENT</span>
        </h3>
        <pre className="truth-report-pre" aria-labelledby="terminal-failure-heading">
          {failureBlock}
        </pre>
      </section>

      <p className="muted product-brief-disclaimer" data-testid="acquisition-brief-disclaimer">
        {boldSegments(pb.disclaimer)}
      </p>
      <div
        className="product-brief-cta-wrap"
        data-testid={pb.testIds.cta}
        role="group"
        aria-label="Run first verification or see failed versus passed run"
      >
        <a
          className="btn"
          href="/verify"
          data-testid="acquisition-try-home-demo-cta"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {productCopy.ctaTaxonomy.awareness}
        </a>{" "}
        <Link
          className="btn secondary"
          href={productCopy.homeHeroSecondaryCta.href}
          data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}
        >
          {productCopy.ctaTaxonomy.decision}
        </Link>
      </div>
    </main>
  );
}
