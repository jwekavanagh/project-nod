import { db } from "@/db/client";
import { funnelEvents, trustAlertCheckpoint, trustAlertDelivery, users } from "@/db/schema";
import { TRUST_BLOCKED_ALERT_MIN_EVENTS } from "@/lib/trustAlertConstants";
import { sendTrustAlertDigestEmail } from "@/lib/sendTrustAlertDigest";
import { and, count, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const DIGEST_SUPPRESS_MS = 24 * 60 * 60 * 1000;

export async function runTrustAlertsCron(): Promise<NextCronResult> {
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MS);
  const windowEnd = new Date(now);

  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      kind: "mail_unconfigured",
      status: 500,
      body: { code: "TRUST_ALERT_MAIL_UNCONFIGURED" },
    };
  }

  const grouped = await db
    .select({
      userId: funnelEvents.userId,
      n: count(),
    })
    .from(funnelEvents)
    .where(
      and(
        eq(funnelEvents.event, "trust_decision_blocked"),
        gte(funnelEvents.createdAt, windowStart),
        isNotNull(funnelEvents.userId),
      ),
    )
    .groupBy(funnelEvents.userId);

  const candidates = grouped.filter((c) => Number(c.n) >= TRUST_BLOCKED_ALERT_MIN_EVENTS);

  const userIds = candidates
    .map((c) => c.userId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (userIds.length === 0) {
    return {
      kind: "skipped",
      status: 204,
      body: { skipped: "below_threshold_or_suppressed_by_cadence" },
    };
  }

  const checkpointRows = await db
    .select()
    .from(trustAlertCheckpoint)
    .where(inArray(trustAlertCheckpoint.userId, userIds));

  const cpMap = new Map(checkpointRows.map((r) => [r.userId, r.lastDigestSentAt]));

  const due: string[] = [];
  for (const uid of userIds) {
    const last = cpMap.get(uid) ?? null;
    if (last === null || now - last.getTime() >= DIGEST_SUPPRESS_MS) {
      due.push(uid);
    }
  }

  if (due.length === 0) {
    return {
      kind: "skipped",
      status: 204,
      body: { skipped: "below_threshold_or_suppressed_by_cadence" },
    };
  }

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, due));

  const sent: Array<{ userId: string; resend_email_id: string }> = [];

  for (const u of userRows) {
    const recent = await db
      .select({ metadata: funnelEvents.metadata, createdAt: funnelEvents.createdAt })
      .from(funnelEvents)
      .where(
        and(
          eq(funnelEvents.userId, u.id),
          eq(funnelEvents.event, "trust_decision_blocked"),
          gte(funnelEvents.createdAt, windowStart),
        ),
      )
      .orderBy(desc(funnelEvents.createdAt))
      .limit(10);

    const bodyText = [
      `AgentSkeptic trust alert (rolling 24h window)`,
      `Window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`,
      `Blocked events (sample up to 10):`,
      ...recent.map((r, i) => `${i + 1}. ${JSON.stringify(r.metadata)}`),
    ].join("\n");

    const resendId = await sendTrustAlertDigestEmail({
      to: u.email,
      subject: "[AgentSkeptic] Trust decision blocks detected",
      textBody: bodyText,
    });

    await db.transaction(async (tx) => {
      await tx.insert(trustAlertDelivery).values({
        userId: u.id,
        resendEmailId: resendId,
        windowStart,
        windowEnd,
      });
      await tx
        .insert(trustAlertCheckpoint)
        .values({ userId: u.id, lastDigestSentAt: new Date(now) })
        .onConflictDoUpdate({
          target: [trustAlertCheckpoint.userId],
          set: { lastDigestSentAt: new Date(now) },
        });
    });

    sent.push({ userId: u.id, resend_email_id: resendId });
  }

  return {
    kind: "delivered",
    status: 200,
    body: { delivered: true, sent },
  };
}

export type NextCronResult =
  | {
      kind: "mail_unconfigured";
      status: 500;
      body: { code: "TRUST_ALERT_MAIL_UNCONFIGURED" };
    }
  | {
      kind: "skipped";
      status: 204;
      body: { skipped: string };
    }
  | {
      kind: "delivered";
      status: 200;
      body: { delivered: true; sent: Array<{ userId: string; resend_email_id: string }> };
    };
