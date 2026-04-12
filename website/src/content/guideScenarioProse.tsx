import type { ReactNode } from "react";

/** Supplemental body copy for /guides/trace-green-postgres-row-missing (beyond problemAnchor from config). */
export function proseTraceGreenPostgres(): ReactNode {
  return (
    <>
      <p className="lede">
        When your graph finishes with a green step list, you still need a read-only check that the row your business logic
        cares about is present in Postgres with the expected columns. Traces record what the runtime believed happened;
        they do not substitute for SELECT results at verification time.
      </p>
      <p>
        AgentSkeptic ingests structured tool activity as NDJSON or JSON, derives expected row identity from your
        registry, and runs read-only SQL. A missing row surfaces as inconsistent with reason ROW_ABSENT even when the
        trace narrative looked successful. Use this pattern after LangGraph runs, before you treat outcomes as safe for
        customers or downstream automation.
      </p>
      <p>
        Start from the bundled demo contrast (wf_complete vs wf_missing), then wire your own tool IDs and tables.
        First-run on your database is documented at /integrate; contract mode with a registry is the audit-grade path
        when you need explicit per-tool expectations rather than inferred checks from Quick Verify.
      </p>
      <p>
        Operational teams often discover this gap only after a silent failure: the ticket never moved, the contact never
        landed, or analytics disagrees with CRM. Running verification as a gate catches that class before release
        trains or compliance sign-off, without pretending the trace proves causality.
      </p>
    </>
  );
}

export function proseToolLoopCrm(): ReactNode {
  return (
    <>
      <p className="lede">
        OpenAI-style tool loops return assistant messages that look authoritative. Your integration layer may still skip
        a write, hit a retry boundary, or persist the wrong shard. The user-visible success string is not the same object
        as a durable CRM or SQLite row that matches tool parameters.
      </p>
      <p>
        AgentSkeptic compares declared tool parameters from structured activity to read-only SELECT results. When the
        expected identity is absent, you see ROW_ABSENT in the workflow result alongside the human truth report. That
        is the wedge between narrative success and database truth at verification time.
      </p>
      <p>
        Map each toolId in your registry to sql_row or relational rules, emit one NDJSON line per observation, and run
        verify against the same database your production path uses in a replay or shadow read. Quick Verify can bootstrap
        inferred checks when you are still shaping the registry.
      </p>
      <p>
        This guide uses the same bundled missing-row fixture as other guides so the ROW_ABSENT contrast stays stable
        across docs and tests. Replace fixtures only after redaction when you publish a new public case; never index
        raw /r/ links for organic discovery because payloads may contain secrets.
      </p>
    </>
  );
}

export function proseCiGreenLogs(): ReactNode {
  return (
    <>
      <p className="lede">
        CI can pass on log replay or synthetic success while the integration database never received the side effect you
        assumed. Pipeline fixtures and mocked stores hide that until production. Read-only verification closes the loop
        on the real database you point at during the job.
      </p>
      <p>
        Emit structured tool observations from the workflow under test, keep a registry aligned with migration truth,
        and fail the job when AgentSkeptic returns inconsistent with ROW_ABSENT. That is a different signal from exit
        code zero on curl mocks: it is state alignment, not proof that a particular HTTP request executed.
      </p>
      <p>
        Pair this with assurance manifests for multi-scenario sweeps when you need time-bounded freshness on saved
        reports. The commercial npm path adds enforce and CI lock fixtures; OSS verify stays local without a license
        server for snapshot checks.
      </p>
      <p>
        Treat verification artifacts as part of the audit trail: attach JSON workflow results and human truth reports
        to the change record so reviewers see expected versus observed, not only green pipeline tiles.
      </p>
    </>
  );
}

export function prosePreProductionGate(): ReactNode {
  return (
    <>
      <p className="lede">
        Before customer-facing or regulated actions, you need a gate that reads authoritative tables with SELECT,
        not another dashboard tile about latency. AgentSkeptic answers whether persisted rows match expectations derived
        from structured tool activity at verification time.
      </p>
      <p>
        Schedule verification after replay or after the live workflow when stakes are high: refunds, account state,
        entitlement toggles, or anything where a wrong row creates liability. ROW_ABSENT is the blunt signal that the
        story and the database disagree even when traces looked fine.
      </p>
      <p>
        Keep the registry the contract for what each tool implies in SQL. Quick Verify can help early exploration, but
        contract mode is the durable story when legal or SRE review asks what was checked. Share private /r/ links only
        for ticket context; indexed discovery lives on these guides and the acquisition page.
      </p>
      <p>
        Operational discipline is to run read-only checks against the same schema version you ship, with credentials
        scoped to SELECT, and to archive the workflow result JSON alongside the human report for later diffing.
      </p>
    </>
  );
}
