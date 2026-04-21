import { EVALUATOR_TRUTH_AND_ADOPTION } from "@/content/marketingContracts";
import Link from "next/link";

/** Homepage “evaluator truth” block — used by `app/page.tsx` and render contract tests. */
export function EvaluatorTruthAndAdoptionSection() {
  const e = EVALUATOR_TRUTH_AND_ADOPTION;
  return (
    <section
      className="home-section"
      data-testid="home-evaluator-truth-and-adoption"
      aria-labelledby="evaluator-truth-heading"
    >
      <h2 id="evaluator-truth-heading">{e.sectionTitle}</h2>
      <h3 className="guarantee-sub">{e.whatWeCheckHeading}</h3>
      <p className="lede">{e.whatWeCheck}</p>
      <h3 className="guarantee-sub">{e.whatEvidenceHeading}</h3>
      <p className="lede">{e.whatEvidence}</p>
      <h3 className="guarantee-sub">{e.whatWeDoNotProveHeading}</h3>
      <p className="lede">{e.whatWeDoNotProve}</p>
      <p className="muted">{e.quickVsContract}</p>
      <p className="lede">{e.crossingCanonicalSentence}</p>
      <p className="muted">{e.antiSubstitutionOneLiner}</p>
      <p className="home-cta-row">
        <Link className="btn" href={e.integrateHref}>
          {e.integrateCtaLabel}
        </Link>
      </p>
    </section>
  );
}
