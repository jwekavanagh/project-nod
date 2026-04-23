import { learnHub, productCopy } from "@/content/productCopy";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { listAllSurfaces } from "@/lib/surfaceMarkdown";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Learn — AgentSkeptic",
  description: productCopy.learnHubIndexDescription,
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical("/guides") },
};

const curatedRouteSet = new Set<string>([
  ...learnHub.popular.map((g) => g.href),
  ...learnHub.debug.map((g) => g.href),
  ...learnHub.buyers.map((g) => g.href),
]);

const exampleLinkLabels = learnHub.exampleLinkLabels as Readonly<Record<string, string>>;

export default function GuidesHubPage() {
  const surfaces = listAllSurfaces();
  const guidesAndScenarios = surfaces.filter(
    (s) => s.route.startsWith("/guides/") && (s.surfaceKind === "guide" || s.surfaceKind === "scenario"),
  );
  const moreSurfaces = guidesAndScenarios.filter((s) => !curatedRouteSet.has(s.route)).sort((a, b) => a.route.localeCompare(b.route));
  const examples = surfaces
    .filter((s) => s.route.startsWith("/examples/"))
    .sort((a, b) => {
      const order = (r: string) =>
        r.includes("wf-complete") ? 0 : r.includes("wf-missing") ? 1 : r.includes("langgraph") ? 2 : 3;
      return order(a.route) - order(b.route) || a.route.localeCompare(b.route);
    });

  return (
    <main className="integrate-main">
      <h1>Learn</h1>
      <p className="lede">{productCopy.learnHubPrimaryLede}</p>
      <p className="lede">{productCopy.guidesHubSupportingSentence}</p>
      <p className="muted">
        {productCopy.guidesHubCompareLead}{" "}
        <Link href="/compare">{productCopy.commercialSurface.compareApproachesLabel}</Link>
      </p>

      <section aria-labelledby="learn-popular-heading">
        <h2 id="learn-popular-heading">{learnHub.popularHeading}</h2>
        <ul className="mechanism-list guide-hub-list">
          {learnHub.popular.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="guide-hub-link">
                <span className="guide-hub-link-title">{g.title}</span>
                <span className="muted guide-hub-link-caption">{g.caption}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="learn-debug-heading">
        <h2 id="learn-debug-heading">{learnHub.debugHeading}</h2>
        <ul className="mechanism-list guide-hub-list">
          {learnHub.debug.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="guide-hub-link">
                <span className="guide-hub-link-title">{g.title}</span>
                <span className="muted guide-hub-link-caption">{g.caption}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="learn-buyers-heading">
        <h2 id="learn-buyers-heading">{learnHub.buyersHeading}</h2>
        <ul className="mechanism-list guide-hub-list">
          {learnHub.buyers.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="guide-hub-link">
                <span className="guide-hub-link-title">{g.title}</span>
                <span className="muted guide-hub-link-caption">{g.caption}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="bundled-proof" className="home-section" aria-labelledby="bundled-proof-heading">
        <h2 id="bundled-proof-heading">{learnHub.bundledProofHeading}</h2>
        <p className="lede">{productCopy.learnBundledProofLedes.primary}</p>
        <p className="lede muted">{productCopy.learnBundledProofLedes.secondaryMuted}</p>
        <ul className="mechanism-list">
          {examples.map((e) => (
            <li key={e.route}>
              <Link href={e.route}>{exampleLinkLabels[e.route] ?? e.title}</Link>
            </li>
          ))}
        </ul>
        <p className="lede">
          {productCopy.learnBundledProofIntegrateLede.before}
          <Link href="/integrate">Get started</Link>
          {productCopy.learnBundledProofIntegrateLede.after}
        </p>
      </section>

      {moreSurfaces.length > 0 ? (
        <section aria-labelledby="learn-more-heading">
          <h2 id="learn-more-heading">{learnHub.moreHeading}</h2>
          <ul className="mechanism-list guide-hub-list">
            {moreSurfaces.map((g) => {
              const captions = productCopy.learnGuideHubCaptions as Record<string, string>;
              const caption = captions[g.route];
              const hubTitles = productCopy.learnGuideHubLinkTitles as Record<string, string | undefined>;
              const linkTitle = hubTitles[g.route] ?? g.title;
              return (
                <li key={g.route}>
                  <Link href={g.route} className="guide-hub-link">
                    <span className="guide-hub-link-title">{linkTitle}</span>
                    {caption ? <span className="muted guide-hub-link-caption">{caption}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="home-section" aria-labelledby="learn-closing-heading">
        <h2 id="learn-closing-heading">{learnHub.closingTitle}</h2>
        <ul className="mechanism-list">
          <li>
            <Link href="/integrate">{learnHub.getStartedCtaLabel}</Link>
          </li>
          <li>
            <Link href="/#try-it">{learnHub.tryDemoCtaLabel}</Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
