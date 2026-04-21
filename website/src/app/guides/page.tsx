import { productCopy } from "@/content/productCopy";
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

export default function GuidesHubPage() {
  const surfaces = listAllSurfaces();
  const guides = surfaces.filter((s) => s.route.startsWith("/guides/") && s.surfaceKind === "guide");
  const scenarios = surfaces.filter((s) => s.route.startsWith("/guides/") && s.surfaceKind === "scenario");
  const examples = surfaces.filter((s) => s.route.startsWith("/examples/"));

  return (
    <main className="integrate-main">
      <h1>Learn</h1>
      <p className="lede">{productCopy.learnHubPrimaryLede}</p>
      <p className="lede">{productCopy.guidesHubSupportingSentence}</p>
      <p className="muted">
        {productCopy.guidesHubCompareLead}{" "}
        <Link href="/compare">{productCopy.commercialSurface.compareApproachesLabel}</Link>
      </p>
      <section aria-labelledby="guides-hub-guides-heading">
        <h2 id="guides-hub-guides-heading">Guides</h2>
        <ul className="mechanism-list guide-hub-list">
          {guides.map((g) => {
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
      <section aria-labelledby="guides-hub-scenarios-heading">
        <h2 id="guides-hub-scenarios-heading">Failure scenarios</h2>
        <ul className="mechanism-list guide-hub-list">
          {scenarios.map((s) => (
            <li key={s.route}>
              <Link href={s.route} className="guide-hub-link">
                <span className="guide-hub-link-title">{s.title}</span>
                <span className="muted guide-hub-link-caption">{s.intent}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section id="bundled-proof" className="home-section" aria-labelledby="bundled-proof-heading">
        <h2 id="bundled-proof-heading">Bundled proof</h2>
        <p className="lede">{productCopy.learnBundledProofLedes.primary}</p>
        <p className="lede muted">{productCopy.learnBundledProofLedes.secondaryMuted}</p>
        <ul className="mechanism-list">
          {examples.map((e) => (
            <li key={e.route}>
              <Link href={e.route}>{e.title}</Link>
            </li>
          ))}
        </ul>
        <p className="lede">
          {productCopy.learnBundledProofIntegrateLede.before}
          <Link href="/integrate">/integrate</Link>
          {productCopy.learnBundledProofIntegrateLede.after}
        </p>
      </section>
    </main>
  );
}
