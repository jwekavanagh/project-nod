import type { TrustDecisionBlockedActivityRow } from "@/lib/loadTrustDecisionBlockedActivity";
import type { ReliabilitySignalsData } from "@/lib/reliabilitySignals";
import { ReliabilitySignalsView } from "./ReliabilitySignalsView";

export function TrustPostureSection(props: {
  reliability: ReliabilitySignalsData;
  blockedActivity: TrustDecisionBlockedActivityRow[];
}) {
  const { reliability, blockedActivity } = props;
  return (
    <section className="trust-posture u-stack" aria-labelledby="trust-posture-heading">
      <h2 id="trust-posture-heading" className="text-lg font-semibold">
        Trust posture
      </h2>
      <ReliabilitySignalsView data={reliability} />
      <div className="card">
        <h3 className="font-medium">Recent blocked irreversible checks</h3>
        {blockedActivity.length === 0 ? (
          <p className="u-mt-1">No recorded blocks in recent history.</p>
        ) : (
          <table className="u-mt-1" data-testid="trust-blocked-table">
            <thead>
              <tr>
                <th scope="col">When (UTC)</th>
                <th scope="col">Workflow</th>
                <th scope="col">Trust</th>
                <th scope="col">Gate</th>
              </tr>
            </thead>
            <tbody>
              {blockedActivity.map((row, i) => (
                <tr key={`${row.createdAtIso}-${row.workflowId}-${i}`}>
                  <td>{row.createdAtIso}</td>
                  <td>
                    <code>{row.workflowId}</code>
                  </td>
                  <td>{row.trustDecision}</td>
                  <td>
                    <code>{row.gateKind}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
