import Link from "next/link";
import { publicProductAnchors } from "@/lib/publicProductAnchors";

export function SiteFooter() {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const openapiHref =
    base.length > 0 ? `${base}/openapi-commercial-v1.yaml` : "/openapi-commercial-v1.yaml";

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav aria-label="Product links">
          <a href={publicProductAnchors.gitRepositoryUrl} rel="noreferrer">
            GitHub
          </a>
          <span className="site-footer-sep"> · </span>
          <a href={publicProductAnchors.npmPackageUrl} rel="noreferrer">
            npm
          </a>
          <span className="site-footer-sep"> · </span>
          <a href={openapiHref}>OpenAPI</a>
        </nav>
        <nav aria-label="Trust and legal">
          <Link href="/security">Security & Trust</Link>
          <span className="site-footer-sep"> · </span>
          <Link href="/privacy">Privacy</Link>
          <span className="site-footer-sep"> · </span>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
