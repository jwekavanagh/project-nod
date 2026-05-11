import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { brandedMarketingTitle, marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";

const title = "Guided activation";
const socialTitle = brandedMarketingTitle(title);
const description = `Quick preview locally (agentskeptic quick); decision-grade gates use agentskeptic check stderr (truth_check_verdict and release_critical_truth_check_verdict first)—the same CLI contract wired in CI. Optional coverage budgets add two more machine lines only when configured.`;

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
