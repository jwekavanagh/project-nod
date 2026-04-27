import { readFileSync } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadLegalMetadata } from "@/lib/plans";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";
import { conversionSpine, productCopy } from "@/content/productCopy";

const privacyTitle = "Privacy Policy — AgentSkeptic";
const privacyDescription =
  "How AgentSkeptic processes account email, billing metadata via Stripe, and usage counters required to enforce plan limits.";

export const metadata: Metadata = {
  title: privacyTitle,
  description: privacyDescription,
  alternates: { canonical: indexableGuideCanonical("/privacy") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({ title: privacyTitle, description: privacyDescription }),
};

export default function PrivacyPage() {
  const meta = loadLegalMetadata();
  const mdPath = path.join(process.cwd(), "content", "legal", "privacy.md");
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
