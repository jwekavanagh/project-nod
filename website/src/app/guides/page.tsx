import { productCopy } from "@/content/productCopy";
import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Learn — AgentSkeptic",
  description: productCopy.learnHubIndexDescription,
  robots: { index: true, follow: true },
  alternates: { canonical: indexableGuideCanonical("/guides") },
};

export default function GuidesHubPage() {
  return (
    <main className="integrate-main">
      <h1>Learn</h1>
      <p className="lede">Problem-oriented guides for trace-shaped success versus database truth.</p>
      <p className="lede">{productCopy.guidesHubSupportingSentence}</p>
      <ul className="mechanism-list">
        {discoveryAcquisition.indexableGuides.map((g) => (
          <li key={g.path}>
            <Link href={g.path}>{g.navLabel}</Link>
          </li>
        ))}
      </ul>
      <section id="bundled-proof" className="home-section" aria-labelledby="bundled-proof-heading">
        <h2 id="bundled-proof-heading">Bundled proof</h2>
        <p className="lede">{productCopy.learnBundledProofLedes.primary}</p>
        <p className="lede muted">{productCopy.learnBundledProofLedes.secondaryMuted}</p>
        <ul className="mechanism-list">
          {discoveryAcquisition.indexableExamples.map((e) => (
            <li key={e.path}>
              <Link href={e.path}>{e.navLabel}</Link>
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
