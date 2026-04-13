import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sendMagicLink", () => ({
  sendMagicLink: sendMock,
}));

import { db } from "@/db/client";
import { magicLinkSendCounters } from "@/db/schema";
import { runMagicLinkVerificationRequest } from "@/lib/runMagicLinkVerificationRequest";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

function makeReq(ip: string): Request {
  return new Request("https://example.internal/", {
    headers: { "x-forwarded-for": ip },
  });
}

describe.skipIf(!hasDatabaseUrl)("magic link full path (integration)", () => {
  const prevE2E = process.env.E2E_COMMERCIAL_FUNNEL;

  beforeEach(async () => {
    process.env.E2E_COMMERCIAL_FUNNEL = "";
    delete process.env.E2E_COMMERCIAL_FUNNEL;
    sendMock.mockClear();
    await db.execute(sql`TRUNCATE TABLE magic_link_send_counter`);
  });

  afterEach(() => {
    if (prevE2E === undefined) {
      delete process.env.E2E_COMMERCIAL_FUNNEL;
    } else {
      process.env.E2E_COMMERCIAL_FUNNEL = prevE2E;
    }
  });

  it("does not call sendMagicLink when the sixth request is rate-limited", async () => {
    const req = makeReq("198.51.100.55");
    const email = `fullpath-${Date.now()}@example.test`;
    const url = "http://127.0.0.1:3000/api/auth/callback/email";
    for (let i = 0; i < 5; i++) {
      await runMagicLinkVerificationRequest({ identifier: email, url, request: req });
    }
    await expect(
      runMagicLinkVerificationRequest({ identifier: email, url, request: req }),
    ).rejects.toMatchObject({ code: "magic_link_rate_limited" });
    expect(sendMock).toHaveBeenCalledTimes(5);
    const rows = await db
      .select()
      .from(magicLinkSendCounters)
      .where(eq(magicLinkSendCounters.scopeKey, email.toLowerCase()));
    expect(rows.find((r) => r.scope === "email")?.count).toBe(5);
  }, 120_000);
});
