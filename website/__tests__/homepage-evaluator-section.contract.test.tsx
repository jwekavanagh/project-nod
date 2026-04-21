/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvaluatorTruthAndAdoptionSection } from "@/app/home/EvaluatorTruthAndAdoptionSection";
import { EVALUATOR_TRUTH_AND_ADOPTION } from "@/content/marketingContracts";

describe("homepage evaluator truth section", () => {
  it("renders contract copy and integrate CTA", () => {
    render(<EvaluatorTruthAndAdoptionSection />);
    const section = screen.getByTestId("home-evaluator-truth-and-adoption");
    expect(
      within(section).getByRole("heading", { level: 2, name: EVALUATOR_TRUTH_AND_ADOPTION.sectionTitle }),
    ).toBeTruthy();
    expect(section).toHaveTextContent(EVALUATOR_TRUTH_AND_ADOPTION.whatWeCheck);
    expect(section).toHaveTextContent(EVALUATOR_TRUTH_AND_ADOPTION.whatEvidence);
    expect(section).toHaveTextContent(EVALUATOR_TRUTH_AND_ADOPTION.whatWeDoNotProve);
    expect(section).toHaveTextContent(EVALUATOR_TRUTH_AND_ADOPTION.quickVsContract);
    expect(section).toHaveTextContent(EVALUATOR_TRUTH_AND_ADOPTION.crossingCanonicalSentence);
    expect(section).toHaveTextContent(EVALUATOR_TRUTH_AND_ADOPTION.antiSubstitutionOneLiner);
    const link = within(section).getByRole("link", { name: EVALUATOR_TRUTH_AND_ADOPTION.integrateCtaLabel });
    expect(link).toHaveAttribute("href", EVALUATOR_TRUTH_AND_ADOPTION.integrateHref);
  });
});
