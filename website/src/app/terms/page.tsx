import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { readFileSync } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadLegalMetadata } from "@/lib/plans";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";

const termsSegmentTitle = "Terms of Service";
const termsPublicTitle = brandedMarketingTitle(termsSegmentTitle);
const termsDescription = "Terms governing use of the AgentSkeptic website, commercial services, and related offerings.";

export const metadata: Metadata = {
  title: termsSegmentTitle,
  description: termsDescription,
  alternates: { canonical: indexableGuideCanonical("/terms") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({ title: termsPublicTitle, description: termsDescription }),
};

export default function TermsPage() {
  const meta = loadLegalMetadata();
  const mdPath = path.join(process.cwd(), "content", "legal", "terms.md");
  let body = readFileSync(mdPath, "utf8");
  body = body
    .replace(/\{\{EFFECTIVE_DATE\}\}/g, meta.effectiveDate)
    .replace(/\{\{TERMS_VERSION\}\}/g, meta.termsVersion);
  return (
    <MarketingPageShell variant="document">
      <article className="integrate-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </article>
    </MarketingPageShell>
  );
}
