import { MarketingPageHeader } from "@/components/marketing/MarketingPageHeader";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "Not found — AgentSkeptic" },
  description: "The page you requested is not on this site.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <MarketingPageShell variant="document" className="not-found-page">
      <MarketingPageHeader title="Page not found" description={<p className="lede">That URL does not match a page on this site.</p>} />
      <p>
        <Link className="btn" href="/">
          Home
        </Link>
      </p>
      <p className="muted not-found-suggestions">
        Try{" "}
        <Link className="link-tertiary" href="/guides">
          Learn
        </Link>
        ,{" "}
        <Link className="link-tertiary" href="/integrate">
          Get started
        </Link>
        , or{" "}
        <Link className="link-tertiary" href="/contact">
          Contact
        </Link>
        .
      </p>
    </MarketingPageShell>
  );
}
