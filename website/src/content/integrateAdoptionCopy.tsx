import type { ReactElement } from "react";

/** GitHub blob path segments (no host); `page.tsx` builds `…/blob/main/${rel}`. */
export const INTEGRATE_DOC_REL_COVERAGE_BUDGETS = "docs/integrate.md#optional-coverage-budgets" as const;
export const INTEGRATE_DOC_REL_AMBIENT_CI = "docs/ambient-ci-distribution.md" as const;

export const INTEGRATE_H2_PREVIEW = "Preview vs contract verification" as const;
export const INTEGRATE_H2_CI = "In CI you get" as const;

export const INTEGRATE_CI_BULLET_1 =
  "A certificate-derived job summary (failure spine + per-step table + witness kinds)." as const;
export const INTEGRATE_CI_BULLET_2 =
  "A downloadable artifact named agentskeptic-outcome-certificate (outcome-certificate.json)." as const;
export const INTEGRATE_CI_BULLET_3 =
  "Structured composite outputs (verdict, state-relation, trust-decision, release-critical-verdict, failing-tool-ids, primary-reason-codes, failing-witness-kinds, recommended-action, automation-safe, certificate-path, plus the existing stdout-path / stderr-path / exit-code)." as const;

export const INTEGRATE_CI_INTRO_NORMALIZED =
  "When you run the first-party GitHub Actions composite at .github/actions/agentskeptic-check (wrapping agentskeptic check), each run exposes three CI surfaces:" as const;

export const INTEGRATE_LINK_LABEL_AMBIENT_CI = "Full CI contract: ambient-ci-distribution.md" as const;

export type IntegrateAdoptionLadderSectionsProps = {
  coverageBudgetsHref: string;
  ambientCiHref: string;
};

export function IntegrateAdoptionLadderSections({
  coverageBudgetsHref,
  ambientCiHref,
}: IntegrateAdoptionLadderSectionsProps): ReactElement {
  return (
    <>
      <h2>{INTEGRATE_H2_PREVIEW}</h2>
      <p>
        <code>agentskeptic quick</code> is a fast <strong>SQL-only preview</strong>: it infers checks from raw tool
        activity against a database you pass. It does <strong>not</strong> run full registry contract verification
        across HTTP, object, vector, or Mongo witnesses.
      </p>
      <p>
        <code>agentskeptic check</code> is the <strong>decision-grade</strong> path: registry + events + readable
        targets, <strong>Outcome Certificate</strong> on <code>stdout</code>, and the{" "}
        <code>truth_check_verdict:</code> / <code>release_critical_truth_check_verdict:</code> lines on{" "}
        <code>stderr</code>. Use{" "}
        <strong>
          <code>agentskeptic check</code> for CI and release gates.
        </strong>
      </p>
      <p>
        <a href={coverageBudgetsHref} rel="noopener noreferrer" target="_blank">
          Optional coverage budgets
        </a>
      </p>

      <h2>{INTEGRATE_H2_CI}</h2>
      <p>
        When you run the first-party GitHub Actions composite at{" "}
        <code>.github/actions/agentskeptic-check</code> (wrapping <code>agentskeptic check</code>), each run exposes
        three CI surfaces:
      </p>
      <ul>
        <li>{INTEGRATE_CI_BULLET_1}</li>
        <li>{INTEGRATE_CI_BULLET_2}</li>
        <li>{INTEGRATE_CI_BULLET_3}</li>
      </ul>
      <p>
        <a href={ambientCiHref} rel="noopener noreferrer" target="_blank">
          {INTEGRATE_LINK_LABEL_AMBIENT_CI}
        </a>
      </p>
    </>
  );
}
