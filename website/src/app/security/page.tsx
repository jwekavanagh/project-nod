import { conversionSpine, productCopy } from "@/content/productCopy";
import { siteMetadata } from "@/content/siteMetadata";
import { getSecurityQuickFacts } from "@/lib/commercialNarrative";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: siteMetadata.security.title,
  description: siteMetadata.security.description,
  alternates: { canonical: indexableGuideCanonical("/security") },
  robots: { index: true, follow: true },
};

export default function SecurityPage() {
  const quickFacts = getSecurityQuickFacts();
  const st = productCopy.securityTrust;
  return (
    <main className="integrate-main">
      <h1>{st.title}</h1>
      <p className="lede">{st.intro}</p>
      <p className="home-cta-row">
        <Link
          href="/integrate"
          className="btn"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {productCopy.ctaTaxonomy.decision}
        </Link>
      </p>
      <ul className="mechanism-list" data-testid="security-buyer-authority-nav">
        <li>
          <Link href="/guides/buyer-commercial-boundary">{productCopy.pricingBuyerCommercialBoundaryLinkLabel}</Link>
        </li>
        <li>
          <Link href="/guides/buyer-ci-enforcement-metering">Buyer: CI enforcement and metering</Link>
        </li>
        <li>
          <Link href="/guides/buyer-trust-production-implications">Buyer: trust and production implications</Link>
        </li>
        <li>
          <Link href="/problems">Problems</Link>
        </li>
        <li>
          <Link href="/compare">{productCopy.homeCommercialCompareApproachesLabel}</Link>
        </li>
      </ul>
      <section data-testid="security-quick-facts" aria-labelledby="security-quick-facts-title">
        <h2 id="security-quick-facts-title">{quickFacts.title}</h2>
        <ul>
          {quickFacts.bullets.map((t, i) => (
            <li key={`sq-${i}`}>{t}</li>
          ))}
        </ul>
      </section>
      {st.sections.map((section) => (
        <section key={section.heading} className="home-section">
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 64)}>{paragraph}</p>
          ))}
        </section>
      ))}
      <section className="home-section" aria-labelledby="security-doc-links">
        <h2 id="security-doc-links">Authoritative documentation</h2>
        <ul>
          <li>
            <a href={st.docLinks.verificationProductSsot} rel="noreferrer">
              Verification product SSOT (trust boundary)
            </a>
          </li>
          <li>
            <a href={st.docLinks.commercialSsot} rel="noreferrer">
              Commercial SSOT
            </a>
          </li>
          <li>
            <Link href="/privacy">Privacy</Link>
          </li>
          <li>
            <Link href="/terms">Terms</Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
