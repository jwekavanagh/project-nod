import { DiscoveryArticleJsonLd } from "@/components/discovery/DiscoveryArticleJsonLd";
import { conversionSpine, productCopy } from "@/content/productCopy";
import marketing from "@/lib/marketing";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { readSurfaceFile } from "@/lib/surfaceMarkdown";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: productCopy.problemsPageMetadata.title,
  description: productCopy.problemsPageMetadata.description,
  alternates: { canonical: indexableGuideCanonical("/problems") },
  robots: { index: true, follow: true },
};

const routeLinkLabels: Record<string, string> = {
  "/integrate": "Get started",
  "/pricing": "Pricing",
  "/database-truth-vs-traces": "How it works",
  "/compare": "Compare",
};

function linkLabelForRoute(route: string): string {
  if (routeLinkLabels[route]) return routeLinkLabels[route];
  const m = route.match(/^\/guides\/([a-z0-9-]+)$/);
  if (m) {
    try {
      return readSurfaceFile("guides", m[1]).title;
    } catch {
      return route;
    }
  }
  return route;
}

export default function ProblemsPage() {
  const rows = marketing.problemIndex;
  return (
    <main className="integrate-main">
      <DiscoveryArticleJsonLd
        headline="Problems the product routes to"
        description={productCopy.problemsPageMetadata.description}
        path="/problems"
        breadcrumbMiddle={{ name: "Learn", path: "/guides" }}
      />
      <h1>Problems</h1>
      <p className="lede">
        {productCopy.problemsHubIntroLead}{" "}
        <Link href="/compare">{productCopy.homeCommercialCompareApproachesLabel}</Link>
        {productCopy.problemsHubIntroTrail}
      </p>
      <p className="home-cta-row">
        <Link
          href="/integrate"
          className="btn"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {productCopy.ctaTaxonomy.decision}
        </Link>
      </p>
      <ol className="mechanism-list">
        {rows.map((row, i) => (
          <li key={`${row.primaryRoute}-${i}`}>
            <p>{row.moment}</p>
            <p className="muted">
              <Link href={row.primaryRoute}>{linkLabelForRoute(row.primaryRoute)}</Link>
              {row.relatedRoutes?.length ? (
                <>
                  {" · "}
                  {row.relatedRoutes.map((r, j) => (
                    <span key={r}>
                      {j > 0 ? " · " : null}
                      <Link href={r}>{linkLabelForRoute(r)}</Link>
                    </span>
                  ))}
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
