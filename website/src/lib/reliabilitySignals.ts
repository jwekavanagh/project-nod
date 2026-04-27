import { db } from "@/db/client";
import { funnelEvents } from "@/db/schema";
import { licensedVerifyOutcomeMetadataSchema } from "@/lib/funnelCommercialMetadata";
import { and, eq, gte, sql } from "drizzle-orm";
import type { z } from "zod";

export type ReasonCodeRow = { code: string; count: number };
export type UnsafeWorkflowRow = { workflowId: string; count: number };

export type ReliabilitySignalsData =
  | {
      kind: "empty";
      message: string;
    }
  | {
      kind: "no_unsafe";
      totalCompletions: number;
      message: string;
    }
  | {
      kind: "full";
      totalCompletions: number;
      unsafeCount: number;
      unsafeRate: string;
      topReasonCodes: ReasonCodeRow[];
      topUnsafeWorkflows: UnsafeWorkflowRow[];
    };

function roundUnsafeRate(unsafe: number, total: number): string {
  if (total <= 0) return "0.0000";
  return (unsafe / total).toFixed(4);
}

type LicensedMeta = z.infer<typeof licensedVerifyOutcomeMetadataSchema>;

/**
 * Last 30 UTC days of licensed_verify_outcome rows (Postgres window).
 */
export async function loadReliabilitySignalsForUser(userId: string): Promise<ReliabilitySignalsData> {
  let rows: Array<{ metadata: unknown }>;
  try {
    rows = await db
      .select({ metadata: funnelEvents.metadata })
      .from(funnelEvents)
      .where(
        and(
          eq(funnelEvents.userId, userId),
          eq(funnelEvents.event, "licensed_verify_outcome"),
          gte(funnelEvents.createdAt, sql<Date>`(now() AT TIME ZONE 'utc') - interval '30 days'`),
        ),
      );
  } catch {
    console.error(JSON.stringify({ kind: "account_reliability_signals_failed", userId }));
    return { kind: "empty", message: "No licensed verification completions in the last 30 days." };
  }

  const parsedRows: LicensedMeta[] = [];
  for (const r of rows) {
    const p = licensedVerifyOutcomeMetadataSchema.safeParse(r.metadata);
    if (!p.success || p.data.schema_version !== 2) continue;
    parsedRows.push(p.data);
  }

  const totalCompletions = parsedRows.length;
  if (totalCompletions === 0) {
    return { kind: "empty", message: "No licensed verification completions in the last 30 days." };
  }

  const unsafeRows = parsedRows.filter(
    (m) => m.trust_decision === "unsafe" || m.trust_decision === "unknown",
  );
  const unsafeCount = unsafeRows.length;

  if (unsafeCount === 0) {
    return {
      kind: "no_unsafe",
      totalCompletions,
      message: "No unsafe outcomes in the last 30 days.",
    };
  }

  const reasonCounts = new Map<string, number>();
  const workflowUnsafeCounts = new Map<string, number>();
  for (const m of unsafeRows) {
    for (const c of m.reason_codes) {
      reasonCounts.set(c, (reasonCounts.get(c) ?? 0) + 1);
    }
    workflowUnsafeCounts.set(m.workflow_id, (workflowUnsafeCounts.get(m.workflow_id) ?? 0) + 1);
  }

  const topReasonCodes = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([code, count]) => ({ code, count }));

  const topUnsafeWorkflows = [...workflowUnsafeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([workflowId, count]) => ({ workflowId, count }));

  return {
    kind: "full",
    totalCompletions,
    unsafeCount,
    unsafeRate: roundUnsafeRate(unsafeCount, totalCompletions),
    topReasonCodes,
    topUnsafeWorkflows,
  };
}
