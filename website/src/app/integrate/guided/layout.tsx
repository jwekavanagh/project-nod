import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";

const title = "Guided activation";
const socialTitle = brandedMarketingTitle(title);
const description = `Proof-first: run agentskeptic quick on your machine, then optionally Formalize a draft registry for contract check and CI enforcement.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: indexableGuideCanonical("/integrate/guided") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({
    title: socialTitle,
    description,
  }),
};

export default function IntegrateGuidedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
