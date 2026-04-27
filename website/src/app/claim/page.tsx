import { OssClaimClient } from "@/components/OssClaimClient";
import { siteMetadata } from "@/content/siteMetadata";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import { Suspense } from "react";

const claimSegmentTitle = "Claim verification run";

export const metadata: Metadata = {
  title: claimSegmentTitle,
  description: siteMetadata.claim.description,
  alternates: { canonical: indexableGuideCanonical("/claim") },
  robots: { index: false, follow: false },
};

export default function ClaimPage() {
  return (
    <main className="claim-page-main">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <OssClaimClient />
      </Suspense>
    </main>
  );
}
