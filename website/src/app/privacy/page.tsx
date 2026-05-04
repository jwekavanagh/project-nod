import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { readFileSync } from "node:fs";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadLegalMetadata } from "@/lib/plans";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";

const privacySegmentTitle = "Privacy Policy";
const privacyPublicTitle = brandedMarketingTitle(privacySegmentTitle);
const privacyDescription =
  "How AgentSkeptic processes account email, billing metadata via Stripe, and usage counters required to enforce plan limits.";

export const metadata: Metadata = {
  title: privacySegmentTitle,
  description: privacyDescription,
  alternates: { canonical: indexableGuideCanonical("/privacy") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({ title: privacyPublicTitle, description: privacyDescription }),
};

export default function PrivacyPage() {
  const meta = loadLegalMetadata();
  const mdPath = path.join(process.cwd(), "content", "legal", "privacy.md");
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
