import { productCopy } from "@/content/productCopy";
import Link from "next/link";

export function HomeVerifyCta() {
  return (
    <section
      id="try-it"
      className="home-section home-try-it"
      data-testid={productCopy.uiTestIds.tryIt}
      aria-labelledby="try-it-heading"
    >
      <h2 id="try-it-heading">Paste events. Verify reality.</h2>
      <p className="muted">
        Run the bundled missing-write proof in under a minute, then edit the NDJSON and rerun in the same session.
      </p>
      <p className="home-cta-row">
        <Link href="/verify" className="btn" data-cta-priority="primary" data-testid="home-verify-cta">
          Try interactive demo
        </Link>
      </p>
    </section>
  );
}
