import { conversionSpine, productCopy } from "@/content/productCopy";
import { siteMetadata } from "@/content/siteMetadata";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: siteMetadata.support.title,
  description: siteMetadata.support.description,
  alternates: { canonical: indexableGuideCanonical("/support") },
  robots: { index: true, follow: true },
};

export default function SupportPage() {
  const { supportPage: page } = productCopy;

  return (
    <main className="integrate-main">
      <h1>{page.h1}</h1>
      <p className="lede">{page.intro}</p>
      <p className="home-cta-row">
        <Link
          href="/pricing"
          className="btn"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          View pricing
        </Link>
      </p>
      {page.sections.map((s) => {
        if (s.kind === "supportIssues") {
          return (
            <section key={s.kind} className="home-section">
              <h2>{s.h2}</h2>
              <p>{s.paragraph}</p>
              <p>
                <a
                  data-testid="support-issues-link"
                  href={publicProductAnchors.bugsUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {s.issuesLinkLabel}
                </a>
              </p>
            </section>
          );
        }
        if (s.kind === "buying") {
          return (
            <section key={s.kind} className="home-section">
              <h2>{s.h2}</h2>
              <p>{s.paragraph}</p>
              <p>
                <Link href={s.cta.href} data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}>
                  {s.cta.label}
                </Link>
              </p>
            </section>
          );
        }
        if (s.kind === "legal") {
          return (
            <section key={s.kind} className="home-section">
              <h2>{s.h2}</h2>
              <ul>
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        }
        if (s.kind === "artifacts") {
          return (
            <section key={s.kind} className="home-section">
              <h2>{s.h2}</h2>
              <ul>
                {s.items.map((it) => (
                  <li key={it.key}>
                    <a
                      href={
                        it.key === "source"
                          ? publicProductAnchors.gitRepositoryUrl
                          : publicProductAnchors.npmPackageUrl
                      }
                      rel="noreferrer"
                      target="_blank"
                    >
                      {it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        }
        return null;
      })}
    </main>
  );
}
