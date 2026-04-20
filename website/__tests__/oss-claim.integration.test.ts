import { POST as postClaimPending } from "@/app/api/oss/claim-pending/route";
import { POST as postClaimRedeem } from "@/app/api/oss/claim-redeem/route";
import { POST as postClaimTicket } from "@/app/api/oss/claim-ticket/route";
import { db } from "@/db/client";
import { funnelEvents, ossClaimTickets, users } from "@/db/schema";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "@/lib/funnelProductActivationConstants";
import { hashOssClaimSecret } from "@/lib/ossClaimSecretHash";
import { OSS_PENDING_CLAIM_COOKIE_NAME } from "@/lib/ossClaimPendingCookie";
import { OSS_CLAIM_PENDING_IP_CAP, OSS_CLAIM_REDEEM_USER_CAP } from "@/lib/ossClaimRateLimits";
import { OSS_CLAIM_TICKET_TTL_MS } from "@/lib/ossClaimTicketTtl";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertPostgresUrlsSafeForTruncate } from "./helpers/assertDestructivePostgresUrlsForTests";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

type AuthMock = { mockResolvedValue(v: unknown): void; mockReset(): void };
const authMock = auth as unknown as AuthMock;

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootPkgPath = join(__dirname, "..", "..", "package.json");
const cliSemver = JSON.parse(readFileSync(rootPkgPath, "utf8")).version as string;

function claimTicketReq(body: object, ip = "203.0.113.55"): NextRequest {
  const h = new Headers({ "content-type": "application/json", "x-forwarded-for": ip });
  h.set(PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER, "cli");
  h.set(PRODUCT_ACTIVATION_CLI_VERSION_HEADER, cliSemver);
  return new NextRequest("http://127.0.0.1:3000/api/oss/claim-ticket", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

function claimRedeemReq(body: object, cookieHeader?: string): NextRequest {
  const h = new Headers({ "content-type": "application/json" });
  if (cookieHeader) {
    h.set("cookie", cookieHeader);
  }
  return new NextRequest("http://127.0.0.1:3000/api/oss/claim-redeem", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

function claimPendingReq(claim_secret: string, ip = "203.0.113.55"): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/api/oss/claim-pending", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ claim_secret }),
  });
}

function pendingCookiePairFromClaimPending(res: Response): string | null {
  const lines = res.headers.getSetCookie();
  for (const line of lines) {
    if (!line.startsWith(`${OSS_PENDING_CLAIM_COOKIE_NAME}=`)) continue;
    if (/\bMax-Age=0\b/i.test(line)) continue;
    return line.split(";")[0]?.trim() ?? null;
  }
  return null;
}

function newClaimSecret(): string {
  return randomBytes(32).toString("hex");
}

describe.skipIf(!hasDatabaseUrl)("OSS claim ticket + redeem", () => {
  beforeEach(async () => {
    assertPostgresUrlsSafeForTruncate("oss-claim.integration");
    await db.execute(sql`
      TRUNCATE oss_claim_ticket, oss_claim_rate_limit_counter, verify_outcome_beacon, funnel_event, stripe_event, usage_reservation, usage_counter, api_key, session, account, "verificationToken", "user" RESTART IDENTITY CASCADE
    `);
    authMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const issuedNow = () => new Date().toISOString();

  it("returns 204 and inserts ticket; duplicate secret returns 204 without extra row", async () => {
    const secret = newClaimSecret();
    const body = {
      claim_secret: secret,
      run_id: "run-claim-1",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    expect((await postClaimTicket(claimTicketReq(body))).status).toBe(204);
    const rows = await db.select().from(ossClaimTickets);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.telemetrySource).toBe("legacy_unattributed");
    expect((await postClaimTicket(claimTicketReq(body))).status).toBe(204);
    const rows2 = await db.select().from(ossClaimTickets);
    expect(rows2).toHaveLength(1);
  });

  it("returns 204 for v2 body and persists telemetry_source", async () => {
    const secret = newClaimSecret();
    const body = {
      schema_version: 2 as const,
      telemetry_source: "unknown" as const,
      claim_secret: secret,
      run_id: "run-claim-v2",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    expect((await postClaimTicket(claimTicketReq(body))).status).toBe(204);
    const rows = await db.select().from(ossClaimTickets);
    expect(rows[0]!.telemetrySource).toBe("unknown");
  });

  it("returns 400 for invalid v2 telemetry_source", async () => {
    const body = {
      schema_version: 2,
      telemetry_source: "legacy_unattributed",
      claim_secret: newClaimSecret(),
      run_id: "run-bad-ts",
      issued_at: issuedNow(),
      terminal_status: "complete",
      workload_class: "non_bundled",
      subcommand: "batch_verify",
      build_profile: "oss",
    };
    expect((await postClaimTicket(claimTicketReq(body))).status).toBe(400);
  });

  it("returns 403 without CLI headers", async () => {
    const req = new NextRequest("http://127.0.0.1:3000/api/oss/claim-ticket", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        claim_secret: newClaimSecret(),
        run_id: "r",
        issued_at: issuedNow(),
        terminal_status: "complete",
        workload_class: "non_bundled",
        subcommand: "batch_verify",
        build_profile: "oss",
      }),
    });
    expect((await postClaimTicket(req)).status).toBe(403);
  });

  it("returns 429 after OSS_CLAIM_TICKET_IP_CAP distinct tickets from same IP", async () => {
    const ip = "203.0.113.99";
    for (let i = 0; i < 60; i++) {
      const res = await postClaimTicket(
        claimTicketReq(
          {
            claim_secret: newClaimSecret(),
            run_id: `run-cap-${i}`,
            issued_at: issuedNow(),
            terminal_status: "complete",
            workload_class: "non_bundled",
            subcommand: "batch_verify",
            build_profile: "oss",
          },
          ip,
        ),
      );
      expect(res.status).toBe(204);
    }
    const over = await postClaimTicket(
      claimTicketReq(
        {
          claim_secret: newClaimSecret(),
          run_id: "run-over",
          issued_at: issuedNow(),
          terminal_status: "complete",
          workload_class: "non_bundled",
          subcommand: "batch_verify",
          build_profile: "oss",
        },
        ip,
      ),
    );
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ code: "rate_limited", scope: "claim_ticket_ip" });
  });

  it("redeem: 200 twice same user; 409 other user; expired and bogus same 400 body", async () => {
    const secret = newClaimSecret();
    const body = {
      claim_secret: secret,
      run_id: "run-redeem-1",
      issued_at: issuedNow(),
      terminal_status: "incomplete" as const,
      workload_class: "bundled_examples" as const,
      subcommand: "quick_verify" as const,
      build_profile: "oss" as const,
    };
    expect((await postClaimTicket(claimTicketReq(body))).status).toBe(204);

    const [u1] = await db
      .insert(users)
      .values({ email: "claim-a@example.com", emailVerified: new Date() })
      .returning();
    const [u2] = await db
      .insert(users)
      .values({ email: "claim-b@example.com", emailVerified: new Date() })
      .returning();

    authMock.mockResolvedValue({
      user: { id: u1!.id, email: "claim-a@example.com", name: null },
    });

    const r1 = await postClaimRedeem(claimRedeemReq({ claim_secret: secret }));
    expect(r1.status).toBe(200);
    const j1 = (await r1.json()) as Record<string, string>;
    expect(j1.run_id).toBe("run-redeem-1");
    expect(j1.terminal_status).toBe("incomplete");

    const r2 = await postClaimRedeem(claimRedeemReq({ claim_secret: secret }));
    expect(r2.status).toBe(200);
    const j2 = (await r2.json()) as Record<string, string>;
    expect(j2.run_id).toBe("run-redeem-1");
    expect(j2.claimed_at).toBe(j1.claimed_at);

    authMock.mockResolvedValue({
      user: { id: u2!.id, email: "claim-b@example.com", name: null },
    });
    const r3 = await postClaimRedeem(claimRedeemReq({ claim_secret: secret }));
    expect(r3.status).toBe(409);
    expect(await r3.json()).toEqual({ code: "already_claimed" });

    const bogus = await postClaimRedeem(claimRedeemReq({ claim_secret: newClaimSecret() }));
    expect(bogus.status).toBe(400);
    const bogusJson = JSON.stringify(await bogus.json());

    const secretExpired = newClaimSecret();
    await postClaimTicket(
      claimTicketReq({
        claim_secret: secretExpired,
        run_id: "run-exp",
        issued_at: issuedNow(),
        terminal_status: "complete",
        workload_class: "non_bundled",
        subcommand: "batch_verify",
        build_profile: "oss",
      }),
    );
    const past = new Date(Date.now() - OSS_CLAIM_TICKET_TTL_MS - 60_000);
    await db
      .update(ossClaimTickets)
      .set({ expiresAt: past })
      .where(eq(ossClaimTickets.secretHash, hashOssClaimSecret(secretExpired)));

    authMock.mockResolvedValue({
      user: { id: u1!.id, email: "claim-a@example.com", name: null },
    });
    const expRes = await postClaimRedeem(claimRedeemReq({ claim_secret: secretExpired }));
    expect(expRes.status).toBe(400);
    expect(JSON.stringify(await expRes.json())).toBe(bogusJson);

    const fe = await db.select().from(funnelEvents).where(eq(funnelEvents.event, "oss_claim_redeemed"));
    expect(fe).toHaveLength(1);
  });

  it("returns 401 when redeem unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const res = await postClaimRedeem(claimRedeemReq({ claim_secret: newClaimSecret() }));
    expect(res.status).toBe(401);
  });

  it("returns 429 after OSS_CLAIM_REDEEM_USER_CAP distinct redeems for same user in same hour", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "claim-rate@example.com", emailVerified: new Date() })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "claim-rate@example.com", name: null },
    });

    for (let i = 0; i < OSS_CLAIM_REDEEM_USER_CAP; i++) {
      const secret = newClaimSecret();
      expect(
        (
          await postClaimTicket(
            claimTicketReq({
              claim_secret: secret,
              run_id: `run-redeem-rate-${i}`,
              issued_at: issuedNow(),
              terminal_status: "complete",
              workload_class: "non_bundled",
              subcommand: "batch_verify",
              build_profile: "oss",
            }),
          )
        ).status,
      ).toBe(204);
      const r = await postClaimRedeem(claimRedeemReq({ claim_secret: secret }));
      expect(r.status).toBe(200);
    }

    const extraSecret = newClaimSecret();
    expect(
      (
        await postClaimTicket(
          claimTicketReq({
            claim_secret: extraSecret,
            run_id: "run-redeem-rate-extra",
            issued_at: issuedNow(),
            terminal_status: "complete",
            workload_class: "non_bundled",
            subcommand: "batch_verify",
            build_profile: "oss",
          }),
        )
      ).status,
    ).toBe(204);

    const over = await postClaimRedeem(claimRedeemReq({ claim_secret: extraSecret }));
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ code: "rate_limited", scope: "claim_redeem_user" });
  });

  it("claim-pending: unknown secrets flatten to 204 noop with clear-style cookie", async () => {
    const ip = "198.51.100.44";
    const ra = await postClaimPending(claimPendingReq(newClaimSecret(), ip));
    const rb = await postClaimPending(claimPendingReq(newClaimSecret(), ip));
    expect(ra.status).toBe(204);
    expect(rb.status).toBe(204);
    expect(await ra.text()).toBe("");
    expect(await rb.text()).toBe("");
    const sa = ra.headers.getSetCookie().join("\n");
    const sb = rb.headers.getSetCookie().join("\n");
    expect(sa).toMatch(/Max-Age=0/i);
    expect(sb).toMatch(/Max-Age=0/i);
  });

  it("claim-pending returns 429 after OSS_CLAIM_PENDING_IP_CAP requests per IP", async () => {
    const ip = "198.51.100.45";
    for (let i = 0; i < OSS_CLAIM_PENDING_IP_CAP; i++) {
      const res = await postClaimPending(claimPendingReq(newClaimSecret(), ip));
      expect(res.status).toBe(204);
    }
    const over = await postClaimPending(claimPendingReq(newClaimSecret(), ip));
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ code: "rate_limited", scope: "claim_pending_ip" });
  });

  it("redeem succeeds with pending cookie and empty JSON body", async () => {
    const secret = newClaimSecret();
    const body = {
      claim_secret: secret,
      run_id: "run-cookie-redeem",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    expect((await postClaimTicket(claimTicketReq(body))).status).toBe(204);

    const ip = "198.51.100.46";
    const pr = await postClaimPending(claimPendingReq(secret, ip));
    expect(pr.status).toBe(204);
    const pair = pendingCookiePairFromClaimPending(pr);
    expect(pair).toBeTruthy();

    const [u] = await db
      .insert(users)
      .values({ email: "cookie-redeem@example.com", emailVerified: new Date() })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "cookie-redeem@example.com", name: null },
    });

    const redeem = await postClaimRedeem(claimRedeemReq({}, pair!));
    expect(redeem.status).toBe(200);
    const j = (await redeem.json()) as { run_id: string };
    expect(j.run_id).toBe("run-cookie-redeem");
    expect(redeem.headers.getSetCookie().join("\n")).toMatch(/Max-Age=0/i);
  });

});
