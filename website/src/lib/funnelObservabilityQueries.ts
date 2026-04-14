import { db } from "@/db/client";
import { funnelEvents } from "@/db/schema";
import { licensedVerifyOutcomeMetadataSchema } from "@/lib/funnelCommercialMetadata";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

function coerceCount(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normative repeat-day count for reserve_allowed funnel rows (UTC calendar dates).
 * SQL lives only in this module — do not duplicate in tests or docs.
 */
export async function countDistinctReserveDaysForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({
      n: sql<number>`count(distinct (${funnelEvents.createdAt} AT TIME ZONE 'UTC')::date)::int`,
    })
    .from(funnelEvents)
    .where(and(eq(funnelEvents.userId, userId), eq(funnelEvents.event, "reserve_allowed")));
  return coerceCount(row?.n);
}

/** `yearMonth` format `YYYY-MM` (UTC month boundaries). */
export async function countDistinctReserveUtcDaysForUserInMonth(
  userId: string,
  yearMonth: string,
): Promise<number> {
  const parts = yearMonth.split("-");
  if (parts.length !== 2) return 0;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));

  const [row] = await db
    .select({
      n: sql<number>`count(distinct (${funnelEvents.createdAt} AT TIME ZONE 'UTC')::date)::int`,
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.userId, userId),
        eq(funnelEvents.event, "reserve_allowed"),
        gte(funnelEvents.createdAt, start),
        lt(funnelEvents.createdAt, end),
      ),
    );
  return coerceCount(row?.n);
}

export type AccountVerificationActivityRow = {
  createdAtIso: string;
  terminalStatus: string;
  workloadClass: string;
  subcommand: string;
};

export type AccountPageVerificationActivity =
  | { ok: true; rows: AccountVerificationActivityRow[]; licensedOutcomesThisUtcMonth: number }
  | { ok: false };

function utcMonthBounds(billingYearMonthUtc: string): { start: Date; endExclusive: Date } | null {
  const parts = billingYearMonthUtc.split("-");
  if (parts.length !== 2) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
    endExclusive: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
  };
}

/** In-memory shaping only; never throws. */
export function shapeAccountPageActivityRows(
  raw: Array<{ createdAt: Date; metadata: unknown }>,
): AccountVerificationActivityRow[] {
  const out: AccountVerificationActivityRow[] = [];
  for (const row of raw) {
    const parsed = licensedVerifyOutcomeMetadataSchema.safeParse(row.metadata);
    if (!parsed.success) continue;
    const meta = parsed.data;
    out.push({
      createdAtIso: row.createdAt.toISOString(),
      terminalStatus: meta.terminal_status,
      workloadClass: meta.workload_class,
      subcommand: meta.subcommand,
    });
    if (out.length >= 10) break;
  }
  return out;
}

export async function loadAccountPageVerificationActivity(
  userId: string,
  billingYearMonthUtc: string,
): Promise<AccountPageVerificationActivity> {
  const bounds = utcMonthBounds(billingYearMonthUtc);
  if (!bounds) {
    return { ok: true, rows: [], licensedOutcomesThisUtcMonth: 0 };
  }
  const monthStartUtc = bounds.start;
  const monthEndExclusiveUtc = bounds.endExclusive;

  try {
    const [monthCountRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(funnelEvents)
      .where(
        and(
          eq(funnelEvents.userId, userId),
          eq(funnelEvents.event, "licensed_verify_outcome"),
          gte(funnelEvents.createdAt, monthStartUtc),
          lt(funnelEvents.createdAt, monthEndExclusiveUtc),
        ),
      );

    const rawCandidates = await db
      .select({
        createdAt: funnelEvents.createdAt,
        metadata: funnelEvents.metadata,
      })
      .from(funnelEvents)
      .where(and(eq(funnelEvents.userId, userId), eq(funnelEvents.event, "licensed_verify_outcome")))
      .orderBy(desc(funnelEvents.createdAt))
      .limit(50);

    return {
      ok: true,
      rows: shapeAccountPageActivityRows(rawCandidates),
      licensedOutcomesThisUtcMonth: coerceCount(monthCountRow?.n),
    };
  } catch {
    console.error(JSON.stringify({ kind: "account_verification_activity_failed", userId }));
    return { ok: false };
  }
}
