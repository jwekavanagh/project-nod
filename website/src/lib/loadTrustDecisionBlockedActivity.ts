import { db } from "@/db/client";
import { funnelEvents } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type TrustDecisionBlockedActivityRow = {
  createdAtIso: string;
  workflowId: string;
  trustDecision: string;
  gateKind: string;
};

/**
 * Recent **`trust_decision_blocked`** rows for account UX (**best-effort** parse of **`metadata`**).
 */
export async function loadTrustDecisionBlockedActivity(
  userId: string,
  limit = 20,
): Promise<TrustDecisionBlockedActivityRow[]> {
  let rows;
  try {
    rows = await db
      .select({ metadata: funnelEvents.metadata, createdAt: funnelEvents.createdAt })
      .from(funnelEvents)
      .where(and(eq(funnelEvents.userId, userId), eq(funnelEvents.event, "trust_decision_blocked")))
      .orderBy(desc(funnelEvents.createdAt))
      .limit(limit);
  } catch {
    return [];
  }

  const out: TrustDecisionBlockedActivityRow[] = [];
  for (const r of rows) {
    const m = r.metadata;
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const snap = o.certificate_snapshot as Record<string, unknown> | undefined;
    const wf =
      typeof snap?.workflow_id === "string"
        ? snap.workflow_id
        : typeof o.workflow_id === "string"
          ? o.workflow_id
          : "unknown";
    const td = typeof o.trust_decision === "string" ? o.trust_decision : "?";
    const gk = typeof o.gate_kind === "string" ? o.gate_kind : "?";
    out.push({
      createdAtIso: r.createdAt?.toISOString?.() ?? "",
      workflowId: wf.slice(0, 128),
      trustDecision: td,
      gateKind: gk,
    });
  }
  return out;
}
