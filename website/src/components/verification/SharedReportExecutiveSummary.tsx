import type { SharedReportExecutiveModel } from "@/lib/shareReportSummary";
import { SHARED_REPORT_AUTHORITY_NOTE } from "@/lib/shareReportFallbacks";

type Props = {
  /** Precomputed so parents control lifecycle (e.g. memoized per certificate). */
  model: SharedReportExecutiveModel;
};

export function SharedReportAuthorityNote() {
  return (
    <p className="muted" data-testid="shared-report-authority-note">
      {SHARED_REPORT_AUTHORITY_NOTE}
    </p>
  );
}

export function SharedReportExecutiveSummary({ model }: Props) {
  return (
    <section className="home-section" aria-labelledby="shared-report-decision-heading">
      <h2 id="shared-report-decision-heading">Decision summary</h2>
      <p data-testid="shared-report-verdict">
        <strong>Verification verdict:</strong> {model.verdictLabel}
      </p>
      <p data-testid="shared-report-headline">
        <strong>Summary:</strong> {model.headline}
      </p>
      <p data-testid="shared-report-reason">
        <strong>Primary reason:</strong> {model.reason}
      </p>
      <p data-testid="shared-report-next-action">
        <strong>Next action:</strong> {model.nextAction}
      </p>
      <p data-testid="shared-report-determinacy">
        <strong>Determinacy:</strong> {model.determinacyLine}
      </p>
      {model.checkedItems.length > 0 ? (
        <div data-testid="shared-report-checked">
          <strong>Checked:</strong>
          <ul>
            {model.checkedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {model.notCheckedItems.length > 0 ? (
        <div data-testid="shared-report-not-checked">
          <strong>Not checked:</strong>
          <ul>
            {model.notCheckedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {model.missingInputItems.length > 0 ? (
        <div data-testid="shared-report-missing-inputs">
          <strong>Missing inputs:</strong>
          <ul>
            {model.missingInputItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
