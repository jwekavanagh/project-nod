import { CredentialsSignin } from "@auth/core/errors";
import { and, eq, lt, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db/client";
import { magicLinkSendCounters } from "@/db/schema";

export const MAGIC_LINK_EMAIL_CAP = 5;
export const MAGIC_LINK_IP_CAP = 30;

const SERIALIZATION_BACKOFF_MS = [5, 10, 25, 40] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSerializationFailure(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  if (err.code === "40001" || err.cause?.code === "40001") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /serialization failure|could not serialize access/i.test(msg);
}

export function utcHourStart(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0),
  );
}

/** ISO `window=` for deny logs (must match normative regex `.000Z`). */
export function formatMagicLinkWindowUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:00:00.000Z`;
}

export function extractClientIpKey(request: Request): string {
  const h = (name: string): string | undefined => {
    const v = request.headers.get(name);
    return v === null || v === undefined ? undefined : v;
  };
  const xff = h("x-forwarded-for") ?? h("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = h("cf-connecting-ip") ?? h("CF-Connecting-IP");
  if (cf?.trim()) return cf.trim();
  const real = h("x-real-ip") ?? h("X-Real-IP");
  if (real?.trim()) return real.trim();
  return "unknown";
}

function denyWithLog(scope: "email" | "ip", windowIso: string, scopeKey: string): never {
  const keyFp = createHash("sha256").update(scopeKey, "utf8").digest("hex");
  console.warn(`[magic_link_rate_limit] deny scope=${scope} window=${windowIso} key_fp=${keyFp}`);
  const e = new CredentialsSignin();
  e.code = "magic_link_rate_limited";
  throw e;
}

function throwSerializationExhausted(): never {
  const e = new CredentialsSignin();
  e.code = "magic_link_rate_limited";
  throw e;
}

async function runReservationTxn(emailKey: string, ipKey: string): Promise<void> {
  const H = utcHourStart();

  await db.transaction(
    async (tx) => {
      await tx
        .insert(magicLinkSendCounters)
        .values({ scope: "email", scopeKey: emailKey, windowStart: H, count: 0 })
        .onConflictDoNothing();

      const eLocked = await tx
        .select()
        .from(magicLinkSendCounters)
        .where(and(eq(magicLinkSendCounters.scope, "email"), eq(magicLinkSendCounters.scopeKey, emailKey)))
        .for("update");

      if (eLocked.length === 0) {
        throw new Error("magic_link_send_counter: email row missing after insert");
      }

      await tx
        .insert(magicLinkSendCounters)
        .values({ scope: "ip", scopeKey: ipKey, windowStart: H, count: 0 })
        .onConflictDoNothing();

      const ipLocked = await tx
        .select()
        .from(magicLinkSendCounters)
        .where(and(eq(magicLinkSendCounters.scope, "ip"), eq(magicLinkSendCounters.scopeKey, ipKey)))
        .for("update");

      if (ipLocked.length === 0) {
        throw new Error("magic_link_send_counter: ip row missing after insert");
      }

      await tx
        .update(magicLinkSendCounters)
        .set({ count: 0, windowStart: H })
        .where(
          and(
            eq(magicLinkSendCounters.scope, "email"),
            eq(magicLinkSendCounters.scopeKey, emailKey),
            lt(magicLinkSendCounters.windowStart, H),
          ),
        );

      await tx
        .update(magicLinkSendCounters)
        .set({ count: 0, windowStart: H })
        .where(
          and(
            eq(magicLinkSendCounters.scope, "ip"),
            eq(magicLinkSendCounters.scopeKey, ipKey),
            lt(magicLinkSendCounters.windowStart, H),
          ),
        );

      const eRow = await tx
        .select()
        .from(magicLinkSendCounters)
        .where(and(eq(magicLinkSendCounters.scope, "email"), eq(magicLinkSendCounters.scopeKey, emailKey)))
        .for("update");

      const ipRow = await tx
        .select()
        .from(magicLinkSendCounters)
        .where(and(eq(magicLinkSendCounters.scope, "ip"), eq(magicLinkSendCounters.scopeKey, ipKey)))
        .for("update");

      const eCount = eRow[0]?.count ?? 0;
      const ipCount = ipRow[0]?.count ?? 0;
      const windowIso = formatMagicLinkWindowUtc(H);

      if (eCount >= MAGIC_LINK_EMAIL_CAP) {
        denyWithLog("email", windowIso, emailKey);
      }
      if (ipCount >= MAGIC_LINK_IP_CAP) {
        denyWithLog("ip", windowIso, ipKey);
      }

      await tx
        .update(magicLinkSendCounters)
        .set({
          count: sql`${magicLinkSendCounters.count} + 1`,
          windowStart: H,
        })
        .where(and(eq(magicLinkSendCounters.scope, "email"), eq(magicLinkSendCounters.scopeKey, emailKey)));

      await tx
        .update(magicLinkSendCounters)
        .set({
          count: sql`${magicLinkSendCounters.count} + 1`,
          windowStart: H,
        })
        .where(and(eq(magicLinkSendCounters.scope, "ip"), eq(magicLinkSendCounters.scopeKey, ipKey)));

      const eAfter = await tx
        .select({ count: magicLinkSendCounters.count })
        .from(magicLinkSendCounters)
        .where(and(eq(magicLinkSendCounters.scope, "email"), eq(magicLinkSendCounters.scopeKey, emailKey)));

      const ipAfter = await tx
        .select({ count: magicLinkSendCounters.count })
        .from(magicLinkSendCounters)
        .where(and(eq(magicLinkSendCounters.scope, "ip"), eq(magicLinkSendCounters.scopeKey, ipKey)));

      if (eAfter.length !== 1 || ipAfter.length !== 1) {
        denyWithLog("email", windowIso, emailKey);
      }
      if (eAfter[0]!.count !== eCount + 1 || ipAfter[0]!.count !== ipCount + 1) {
        denyWithLog("email", windowIso, emailKey);
      }
    },
    { isolationLevel: "serializable" },
  );
}

/**
 * Reserves one magic-link send slot for the current UTC hour (email + ip scopes).
 * Throws {@link CredentialsSignin} with `code = "magic_link_rate_limited"` when denied.
 */
export async function reserveMagicLinkSendSlot(request: Request, identifier: string): Promise<void> {
  if (process.env.E2E_COMMERCIAL_FUNNEL === "1") {
    return;
  }

  const emailKey = identifier;
  const ipKey = extractClientIpKey(request);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await runReservationTxn(emailKey, ipKey);
      return;
    } catch (e) {
      if (e instanceof CredentialsSignin) {
        throw e;
      }
      if (isSerializationFailure(e) && attempt < 4) {
        await sleep(SERIALIZATION_BACKOFF_MS[attempt]!);
        continue;
      }
      if (isSerializationFailure(e)) {
        throwSerializationExhausted();
      }
      throw e;
    }
  }
  throwSerializationExhausted();
}
