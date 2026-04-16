import { CredentialsSignin } from "@auth/core/errors";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertPostgresUrlsSafeForTruncate } from "./helpers/assertDestructivePostgresUrlsForTests";
import { db } from "@/db/client";
import { magicLinkSendCounters } from "@/db/schema";
import { reserveMagicLinkSendSlot } from "@/lib/magicLinkSendGate";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

function makeReq(ip: string): Request {
  return new Request("https://example.internal/", {
    headers: { "x-forwarded-for": ip },
  });
}

const DENY_LOG =
  /^\[magic_link_rate_limit\] deny scope=(email|ip) window=\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z key_fp=[0-9a-f]{64}$/;

describe.skipIf(!hasDatabaseUrl)("magic link send gate (integration)", () => {
  const prevE2E = process.env.E2E_COMMERCIAL_FUNNEL;

  beforeEach(async () => {
    assertPostgresUrlsSafeForTruncate("magic-link-send-gate.integration");
    process.env.E2E_COMMERCIAL_FUNNEL = "";
    delete process.env.E2E_COMMERCIAL_FUNNEL;
    await db.execute(sql`TRUNCATE TABLE magic_link_send_counter`);
  });

  afterEach(() => {
    if (prevE2E === undefined) {
      delete process.env.E2E_COMMERCIAL_FUNNEL;
    } else {
      process.env.E2E_COMMERCIAL_FUNNEL = prevE2E;
    }
  });

  it("allows exactly five reservations per email per UTC hour then denies the sixth", async () => {
    const req = makeReq("198.51.100.1");
    const email = "gate-seq-1@example.test";
    for (let i = 0; i < 5; i++) {
      await reserveMagicLinkSendSlot(req, email);
    }
    await expect(reserveMagicLinkSendSlot(req, email)).rejects.toMatchObject({
      code: "magic_link_rate_limited",
    });
    const rows = await db
      .select()
      .from(magicLinkSendCounters)
      .where(eq(magicLinkSendCounters.scopeKey, email));
    const emailRow = rows.find((r) => r.scope === "email");
    expect(emailRow?.count).toBe(5);
  });

  it("deny does not mutate counters (snapshot before/after)", async () => {
    const req = makeReq("198.51.100.2");
    const email = "gate-snap@example.test";
    for (let i = 0; i < 5; i++) {
      await reserveMagicLinkSendSlot(req, email);
    }
    const before = await db.select().from(magicLinkSendCounters);
    await expect(reserveMagicLinkSendSlot(req, email)).rejects.toBeInstanceOf(CredentialsSignin);
    const after = await db.select().from(magicLinkSendCounters);
    expect(JSON.stringify(before.sort(sortRow))).toBe(JSON.stringify(after.sort(sortRow)));
  });

  it("emits exactly one deny log line matching the normative regex", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = makeReq("198.51.100.3");
    const email = "gate-log@example.test";
    for (let i = 0; i < 5; i++) {
      await reserveMagicLinkSendSlot(req, email);
    }
    await expect(reserveMagicLinkSendSlot(req, email)).rejects.toMatchObject({
      code: "magic_link_rate_limited",
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toMatch(DENY_LOG);
    warnSpy.mockRestore();
  });

  it("allows only five of six concurrent reservations for the same email", async () => {
    const req = makeReq("198.51.100.10");
    const email = "gate-conc-same@example.test";
    const settled = await Promise.allSettled(
      Array.from({ length: 6 }, () => reserveMagicLinkSendSlot(req, email)),
    );
    const fulfilled = settled.filter((s) => s.status === "fulfilled").length;
    const rejected = settled.filter((s) => s.status === "rejected").length;
    expect(fulfilled).toBe(5);
    expect(rejected).toBe(1);
    const rej = settled.find((s) => s.status === "rejected") as PromiseRejectedResult;
    expect(rej.reason).toMatchObject({ code: "magic_link_rate_limited" });
    const emailRow = await db
      .select()
      .from(magicLinkSendCounters)
      .where(eq(magicLinkSendCounters.scopeKey, email));
    expect(emailRow.find((r) => r.scope === "email")?.count).toBe(5);
  }, 120_000);

  it("allows only thirty of thirty-one concurrent reservations sharing the same IP", async () => {
    const ip = "198.51.100.77";
    const req = makeReq(ip);
    const suffix = `${Date.now()}`;
    const settled = await Promise.allSettled(
      Array.from({ length: 31 }, (_, i) =>
        reserveMagicLinkSendSlot(req, `ipburst-${suffix}-${i}@example.test`),
      ),
    );
    const fulfilled = settled.filter((s) => s.status === "fulfilled").length;
    const rejected = settled.filter((s) => s.status === "rejected").length;
    expect(fulfilled).toBe(30);
    expect(rejected).toBe(1);
    const ipRow = await db
      .select()
      .from(magicLinkSendCounters)
      .where(eq(magicLinkSendCounters.scopeKey, ip));
    expect(ipRow.find((r) => r.scope === "ip")?.count).toBe(30);
  }, 120_000);
});

function sortRow(
  a: { scope: string; scopeKey: string },
  b: { scope: string; scopeKey: string },
): number {
  return `${a.scope}\0${a.scopeKey}`.localeCompare(`${b.scope}\0${b.scopeKey}`);
}
