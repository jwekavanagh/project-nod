import Link from "next/link";
import type { ReliabilitySignalsData } from "@/lib/reliabilitySignals";

const TELEMETRY_DOC_HREF =
  "https://github.com/jwekavanagh/agentskeptic/blob/main/docs/trust-authority-layer.md";

export function ReliabilitySignalsView({ data }: { data: ReliabilitySignalsData }) {
  return (
    <section className="card u-mt-1" data-testid="reliability-signals">
      <h2>Reliability signals</h2>
      {data.kind === "empty" ? (
        <p data-testid="reliability-empty">
          {data.message}{" "}
          <Link href={TELEMETRY_DOC_HREF}>Telemetry setup</Link>
        </p>
      ) : null}
      {data.kind === "no_unsafe" ? (
        <p data-testid="reliability-no-unsafe">
          {data.message} ({data.totalCompletions} completions)
        </p>
      ) : null}
      {data.kind === "full" ? (
        <>
          <h3>What failed most often?</h3>
          <table data-testid="reliability-reason-table">
            <thead>
              <tr>
                <th>Reason code</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.topReasonCodes.map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="u-mt-1">Which workflows drove unsafe outcomes?</h3>
          <table data-testid="reliability-workflow-table">
            <thead>
              <tr>
                <th>Workflow ID</th>
                <th>Unsafe count</th>
              </tr>
            </thead>
            <tbody>
              {data.topUnsafeWorkflows.map((r) => (
                <tr key={r.workflowId}>
                  <td>{r.workflowId}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="u-mt-1">How often were outcomes unsafe?</h3>
          <p data-testid="reliability-rate">
            Unsafe rate: {data.unsafeRate} ({data.unsafeCount} of {data.totalCompletions} completions)
          </p>
        </>
      ) : null}
    </section>
  );
}
