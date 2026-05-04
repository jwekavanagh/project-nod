import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { productCopy } from "@/content/productCopy";
import { siteMetadata } from "@/content/siteMetadata";
import { getSecurityQuickFacts } from "@/lib/commercialNarrative";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const securityDescription = siteMetadata.security.description;
const securitySegmentTitle = "Security & Trust";
const securityPublicTitle = brandedMarketingTitle(securitySegmentTitle);

export const metadata: Metadata = {
  title: securitySegmentTitle,
  description: securityDescription,
  alternates: { canonical: indexableGuideCanonical("/security") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({ title: securityPublicTitle, description: securityDescription }),
};

export default function SecurityPage() {
  const quickFacts = getSecurityQuickFacts();
  const st = productCopy.securityTrust;
  return (
    <MarketingPageShell variant="documentProse">
      <MarketingPageHeader title={st.title} />
      <section data-testid="security-quick-facts" aria-labelledby="security-quick-facts-title">
        <h2 id="security-quick-facts-title">{quickFacts.title}</h2>
        <ul>
          {quickFacts.bullets.map((t, i) => (
            <li key={`sq-${i}`}>{t}</li>
          ))}
        </ul>
      </section>
      <section className="home-section" aria-labelledby="security-doc-links">
        <h2 id="security-doc-links">Authoritative documentation</h2>
        <ul>
          <li>
            <a href={st.docLinks.verificationSemanticsHref} rel="noreferrer">
              Verification semantics (Outcome Certificate)
            </a>
          </li>
          <li>
            <a href={st.docLinks.commercialSsotHref} rel="noreferrer">
              Commercial terms (mechanics and metering)
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
    </MarketingPageShell>
  );
}
