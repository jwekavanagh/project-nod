import { conversionSpine, productCopy } from "@/content/productCopy";
import { enterpriseMailtoHref } from "@/lib/contactSalesEmail";
import { indexableGuideCanonical } from "@/lib/indexableGuides";
import { marketingOpenGraphAndTwitter } from "@/lib/marketingSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";

const contactTitle = "Contact — AgentSkeptic";
const contactDescription =
  "Reach Enterprise sales for procurement, custom limits, and contract terms. Other questions route through Support.";

export const metadata: Metadata = {
  title: contactTitle,
  description: contactDescription,
  alternates: { canonical: indexableGuideCanonical("/contact") },
  robots: { index: true, follow: true },
  ...marketingOpenGraphAndTwitter({ title: contactTitle, description: contactDescription }),
};

export default function ContactPage() {
  const salesMailto = enterpriseMailtoHref();

  return (
    <main className="contact-page">
      <h1>Contact</h1>
      <p className="contact-lede">
        For Enterprise procurement, tailored limits, on-prem options, or custom contract terms, reach sales directly.
      </p>
      <p>
        <Link
          className="btn"
          href="/pricing"
          data-cta-priority={conversionSpine.ctaPriorityPrimaryValue}
        >
          View pricing
        </Link>
      </p>
      <p>
        <a
          className="btn secondary"
          href={salesMailto}
          data-cta-priority={conversionSpine.ctaPrioritySecondaryValue}
        >
          {productCopy.pricingBillingAndQuestionsBand.enterpriseCtaLabel}
        </a>
      </p>
      <p className="muted contact-support-note">
        For product issues, integration help, or bugs, use{" "}
        <Link href="/support">{productCopy.pricingBillingAndQuestionsBand.secondaryLinks[1].label}</Link>
        .
      </p>
    </main>
  );
}
