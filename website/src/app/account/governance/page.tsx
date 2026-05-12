import Link from "next/link";
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { enforcementBaselines, enforcementEvents, enforcementLifecycle, governanceAcceptance, governanceEvidence } from "@/db/schema";
import { relianceClassFromRunKind } from "@/lib/governanceDisplay";

export const dynamic = "force-dynamic";

function relianceClassFromMetadata(metadata: unknown): "provisional" | "eligible" {
  if (!metadata || typeof metadata !== "object") return "eligible";
  const m = metadata as Record<string, unknown>;
  return m.reliance_class === "provisional" ? "provisional" : "eligible";
}

export default async function GovernancePage() {
  const session = await auth();
  if (!session?.user?.id) unauthorized();

  const lifecycles = await db
    .select({
      workflowId: enforcementLifecycle.workflowId,
      currentState: enforcementLifecycle.currentState,
      stateVersion: enforcementLifecycle.stateVersion,
      pendingAcceptProjectionHash: enforcementLifecycle.pendingAcceptProjectionHash,
    })
    .from(enforcementLifecycle)
    .where(eq(enforcementLifecycle.userId, session.user.id));
  const lifecycleByWorkflow = new Map(lifecycles.map((row) => [row.workflowId, row]));

  const baselines = await db
    .select({
      id: enforcementBaselines.id,
      workflowId: enforcementBaselines.workflowId,
      projectionHash: enforcementBaselines.projectionHash,
      needsRebaseline: enforcementBaselines.needsRebaseline,
      updatedAt: enforcementBaselines.updatedAt,
      baselineEvidenceId: enforcementBaselines.baselineEvidenceId,
      activeAcceptanceId: enforcementBaselines.activeAcceptanceId,
      evidenceRunId: governanceEvidence.runId,
      evidenceCertificateSha256: governanceEvidence.certificateSha256,
      evidenceMaterialTruthSha256: governanceEvidence.materialTruthSha256,
      evidenceCertificateJson: governanceEvidence.certificateJson,
    })
    .from(enforcementBaselines)
    .leftJoin(governanceEvidence, eq(enforcementBaselines.baselineEvidenceId, governanceEvidence.id))
    .where(eq(enforcementBaselines.userId, session.user.id))
    .orderBy(desc(enforcementBaselines.updatedAt))
    .limit(25);
  const events = await db
    .select()
    .from(enforcementEvents)
    .where(eq(enforcementEvents.userId, session.user.id))
    .orderBy(desc(enforcementEvents.createdAt))
    .limit(200);

  const acceptances = await db
    .select()
    .from(governanceAcceptance)
    .where(eq(governanceAcceptance.userId, session.user.id))
    .orderBy(desc(governanceAcceptance.createdAt))
    .limit(50);

  return (
    <main>
      <h1>Governance</h1>
      <p className="u-mb-1">
        Read-only baseline and event timeline. Export returns{" "}
        <code>GovernanceAuditBundleV3</code> JSON (<code>schemaVersion: 3</code>): governance window, lifecycle rows,
        baseline, events, and slice-keyed <code>evidenceSlices</code> (decision exit, completeness, fingerprints) tied to
        each stored evidence row. Semantic parity with CLI enforcement uses the same certificate JSON and core hash
        helpers; the forensic <code>--write-run-bundle</code> NDJSON layout remains CLI-only — see{" "}
        <Link href="https://github.com/jwekavanagh/agentskeptic/blob/main/docs/decision-evidence-bundle.md">decision evidence bundle</Link>
        .
      </p>
      <div className="card u-mb-1">
        <h2>Baselines</h2>
        {baselines.length === 0 ? <p>No baselines yet.</p> : null}
        {baselines.map((b) => {
          const lc = lifecycleByWorkflow.get(b.workflowId);
          const certJson = b.evidenceCertificateJson as Record<string, unknown> | null | undefined;
          const runKind = typeof certJson?.runKind === "string" ? certJson.runKind : "—";
          const runKindForReliance = runKind === "—" ? undefined : runKind;
          return (
          <div key={b.id} className="u-mb-1">
            <div><strong>workflow_id:</strong> {b.workflowId}</div>
            <div>
              <strong>lifecycle_state:</strong>{" "}
              {lc?.currentState ?? "baseline_missing"}
            </div>
            <div>
              <strong>lifecycle_state_version:</strong>{" "}
              {lc?.stateVersion ?? 0}
            </div>
            {lc?.pendingAcceptProjectionHash ?
              <div>
                <strong>expected_projection_hash_for_accept:</strong>{" "}
                {lc.pendingAcceptProjectionHash}
              </div>
            : null}
            <div><strong>baseline_set_at:</strong> {b.updatedAt.toISOString()}</div>
            <div><strong>baseline_evidence_run_id:</strong> {b.evidenceRunId ?? "—"}</div>
            <div><strong>baseline_evidence_certificate_sha256:</strong> {b.evidenceCertificateSha256 ?? "—"}</div>
            <div><strong>baseline_evidence_material_truth_sha256:</strong> {b.evidenceMaterialTruthSha256 ?? "—"}</div>
            <div><strong>baseline_material_truth_sha256:</strong> {b.projectionHash}</div>
            <div><strong>baseline_run_kind:</strong> {runKind}</div>
            <div><strong>reliance_class:</strong> {relianceClassFromRunKind(runKindForReliance)}</div>
            <div><strong>needs_rebaseline:</strong> {b.needsRebaseline ? "yes" : "no"}</div>
            <div>
              <strong>active_governed_acceptance_id:</strong> {b.activeAcceptanceId ?? "—"}
            </div>
            <div className="u-mt-half">
              <Link href={`/api/v1/governance/export?workflow_id=${encodeURIComponent(b.workflowId)}`}>
                Export governance JSON
              </Link>
            </div>
          </div>
          );
        })}
      </div>
      <div className="card u-mb-1">
        <h2>Governed acceptances</h2>
        {acceptances.length === 0 ? <p>No governed drift acceptances recorded yet.</p> : null}
        {acceptances.map((a) => {
          const links = Array.isArray(a.evidenceLinks)
            ? (a.evidenceLinks as unknown[]).filter((x): x is string => typeof x === "string")
            : [];
          return (
            <div key={a.id} className="u-mb-1">
              <div>
                <strong>acceptance_id:</strong> {a.id}
              </div>
              <div>
                <strong>workflow_id:</strong> {a.workflowId}
              </div>
              <div>
                <strong>acceptance_reason:</strong> {a.acceptanceReason}
              </div>
              <div>
                <strong>acceptance_owner:</strong> {a.acceptanceOwner}
              </div>
              <div>
                <strong>accepted_material_truth_sha256:</strong> {a.acceptedMaterialTruthSha256}
              </div>
              {a.exceptionReviewBy ? (
                <div>
                  <strong>exception_review_by:</strong> {a.exceptionReviewBy.toISOString()}
                </div>
              ) : null}
              {links.length > 0 ? (
                <div>
                  <strong>evidence_links:</strong>{" "}
                  {links.map((href) => (
                    <span key={href} className="u-mr-half">
                      <a href={href} rel="noreferrer noopener" target="_blank">
                        {href}
                      </a>
                    </span>
                  ))}
                </div>
              ) : null}
              <div>
                <strong>created_at:</strong> {a.createdAt.toISOString()}
              </div>
              <div className="u-mt-half">
                <Link href={`/api/v1/governance/export?workflow_id=${encodeURIComponent(a.workflowId)}`}>
                  Export governance JSON
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      <div className="card">
        <h2>Events</h2>
        {events.length === 0 ? <p>No events yet.</p> : null}
        {events.map((e) => (
          <div key={e.id} className="u-mb-1">
            <div><strong>created_at:</strong> {e.createdAt.toISOString()}</div>
            <div><strong>event_type:</strong> {e.event}</div>
            <div><strong>run_id:</strong> {e.runId}</div>
            <div><strong>material_truth_sha256:</strong> {e.actualProjectionHash}</div>
            <div><strong>certificate_sha256:</strong> {String((e.metadata as Record<string, unknown> | null)?.certificate_sha256 ?? "n/a")}</div>
            <div>
              <strong>lifecycle_state:</strong> {lifecycleByWorkflow.get(e.workflowId)?.currentState ?? "—"}
            </div>
            <div>
              <strong>event_drift_marker:</strong> {e.event === "drift_detected" ? "drift_observed_in_timeline" : "not_drift_event"}
            </div>
            <div><strong>reliance_class:</strong> {relianceClassFromMetadata(e.metadata)}</div>
            <div className="u-mt-half">
              <Link href={`/api/v1/governance/export?workflow_id=${encodeURIComponent(e.workflowId)}`}>
                Export governance JSON
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
