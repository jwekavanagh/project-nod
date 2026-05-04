import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { VerificationReportView } from "@/components/VerificationReportView";
import { productCopy } from "@/content/productCopy";
import indexedGuideFixture from "@/content/indexedGuideFixture";
import {
  derivedFieldsFromEnvelope,
  type PublicReportEnvelope,
} from "@/lib/publicVerificationReportService";
import Link from "next/link";
import type { ReactNode } from "react";

const embed = indexedGuideFixture as unknown as PublicReportEnvelope;
const humanText = derivedFieldsFromEnvelope(embed).humanText;

type Props = {
  children: ReactNode;
  /** When set, replaces the default single “Run first-run integration” row (discovery surfaces use `SurfaceProgression`). */
  progressionStrip?: ReactNode;
};

/**
 * Shared layout for indexable /guides/* acquisition pages: prose, bundled verification embed, single integrate CTA.
 */
export function IndexedGuideShell({ children, progressionStrip }: Props) {
  return (
    <MarketingPageShell variant="document" data-testid="indexed-guide-shell">
      {children}
      <section className="home-section" aria-labelledby="embed-heading">
        <h2 id="embed-heading">{productCopy.indexedGuideEmbedTitle}</h2>
        <p className="muted">{productCopy.indexedGuideEmbedMuted}</p>
        <VerificationReportView humanText={humanText} payload={embed} variant="embed" />
      </section>
      {progressionStrip ?? (
        <p className="home-cta-row">
          <Link className="btn" href="/integrate">
            Run first-run integration
          </Link>
        </p>
      )}
    </MarketingPageShell>
  );
}
