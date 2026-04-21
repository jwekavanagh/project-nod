import { OssClaimClient } from "@/components/OssClaimClient";
import { siteMetadata } from "@/content/siteMetadata";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: siteMetadata.claim.title,
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
