import Link from "next/link";
import { unauthorized } from "next/navigation";
import { auth } from "@/auth";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { enforcementBaselines, enforcementEvents } from "@/db/schema";

export const dynamic = "force-dynamic";

function relianceClassFromMetadata(metadata: unknown): "provisional" | "eligible" {
  if (!metadata || typeof metadata !== "object") return "eligible";
  const m = metadata as Record<string, unknown>;
  return m.reliance_class === "provisional" ? "provisional" : "eligible";
}

export default async function GovernancePage() {
  const session = await auth();
  if (!session?.user?.id) unauthorized();

  const baselines = await db
    .select()
    .from(enforcementBaselines)
    .where(eq(enforcementBaselines.userId, session.user.id))
    .orderBy(desc(enforcementBaselines.updatedAt))
    .limit(25);
  const events = await db
    .select()
    .from(enforcementEvents)
    .where(eq(enforcementEvents.userId, session.user.id))
    .orderBy(desc(enforcementEvents.createdAt))
    .limit(200);

  return (
    <main>
      <h1>Governance</h1>
      <p className="u-mb-1">Read-only baseline and event timeline with evidence links.</p>
      <div className="card u-mb-1">
        <h2>Baselines</h2>
        {baselines.length === 0 ? <p>No baselines yet.</p> : null}
        {baselines.map((b) => (
          <div key={b.id} className="u-mb-1">
            <div><strong>workflow_id:</strong> {b.workflowId}</div>
            <div><strong>baseline_set_at:</strong> {b.updatedAt.toISOString()}</div>
            <div><strong>baseline_run_id:</strong> n/a</div>
            <div><strong>baseline_material_truth_sha256:</strong> {b.projectionHash}</div>
            <div><strong>baseline_run_kind:</strong> n/a</div>
            <div><strong>reliance_class:</strong> {b.needsRebaseline ? "provisional" : "eligible"}</div>
            <div className="u-mt-half">
              <Link href={`/api/v1/governance/export?workflow_id=${encodeURIComponent(b.workflowId)}`}>
                Download Audit Bundle
              </Link>
            </div>
          </div>
        ))}
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
            <div><strong>drift_status:</strong> {e.event === "drift_detected" ? "drift" : "ok"}</div>
            <div><strong>reliance_class:</strong> {relianceClassFromMetadata(e.metadata)}</div>
            <div className="u-mt-half">
              <Link href={`/api/v1/governance/export?workflow_id=${encodeURIComponent(e.workflowId)}`}>View Evidence</Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
