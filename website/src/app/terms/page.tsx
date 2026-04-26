import { readFileSync } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadLegalMetadata } from "@/lib/plans";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import Link from "next/link";
import { conversionSpine, productCopy } from "@/content/productCopy";

export const metadata: Metadata = {
  title: "Terms of Service — AgentSkeptic",
  description: "Terms governing use of the AgentSkeptic website, commercial services, and related offerings.",
  alternates: { canonical: indexableGuideCanonical("/terms") },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const meta = loadLegalMetadata();
  const mdPath = path.join(process.cwd(), "content", "legal", "terms.md");
  let body = readFileSync(mdPath, "utf8");
  body = body
    .replace(/\{\{EFFECTIVE_DATE\}\}/g, meta.effectiveDate)
    .replace(/\{\{TERMS_VERSION\}\}/g, meta.termsVersion);
  return (
    <main className="integrate-main">
      <p className="home-cta-row">
        <Link
          className="btn"
          href="/integrate"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          {productCopy.ctaTaxonomy.decision}
        </Link>
      </p>
      <article className="integrate-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>
    </main>
  );
}
