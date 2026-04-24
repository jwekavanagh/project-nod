import { GET as getClaimHandoffLegacy } from "@/app/api/oss/claim-handoff/route";
import { POST as postClaimContinuation } from "@/app/api/oss/claim-continuation/route";
import { POST as postClaimRedeem } from "@/app/api/oss/claim-redeem/route";
import { POST as postClaimTicket } from "@/app/api/oss/claim-ticket/route";
import { GET as getVerifyLink } from "@/app/verify/link/route";
import { db } from "@/db/client";
import { funnelEvents, ossClaimTickets, users } from "@/db/schema";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "@/lib/funnelProductActivationConstants";
import { claimHandoffErrorRedirect, claimHandoffSigninRedirect } from "@/lib/ossClaimHandoffUrl";
import { hashOssClaimSecret } from "@/lib/ossClaimSecretHash";
import { OSS_PENDING_CLAIM_COOKIE_NAME } from "@/lib/ossClaimPendingCookie";
import {
  OSS_CLAIM_HANDOFF_IP_CAP,
  OSS_CLAIM_REDEEM_USER_CAP,
  OSS_CLAIM_TICKET_IP_CAP,
} from "@/lib/ossClaimRateLimits";
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

function claimVerifyLinkReq(h: string, ip = "203.0.113.56"): NextRequest {
  return new NextRequest(`http://127.0.0.1:3000/verify/link?h=${encodeURIComponent(h)}`, {
    method: "GET",
    headers: { "x-forwarded-for": ip },
  });
}

function claimHandoffLegacyReq(h: string, ip = "203.0.113.56"): NextRequest {
  return new NextRequest(`http://127.0.0.1:3000/api/oss/claim-handoff?h=${encodeURIComponent(h)}`, {
    method: "GET",
    headers: { "x-forwarded-for": ip },
  });
}

function hFromHandoffUrl(handoffUrl: string): string {
  const v = new URL(handoffUrl).searchParams.get("h");
  if (!v) throw new Error("missing h");
  return v;
}

function pendingCookiePairFromResponse(res: Response): string | null {
  const lines = res.headers.getSetCookie();
  for (const line of lines) {
    if (!line.startsWith(`${OSS_PENDING_CLAIM_COOKIE_NAME}=`)) continue;
    if (/\bMax-Age=0\b/i.test(line)) continue;
    return line.split(";")[0]?.trim() ?? null;
  }
  return null;
}

async function expectTicket200(body: object): Promise<{ handoff_url: string }> {
  const res = await postClaimTicket(claimTicketReq(body));
  expect(res.status).toBe(200);
  expect(res.headers.get("x-request-id")).toBeTruthy();
  const j = (await res.json()) as { schema_version?: number; handoff_url?: string };
  expect(j.schema_version).toBe(2);
  expect(typeof j.handoff_url).toBe("string");
  expect(j.handoff_url).toContain("/verify/link?");
  return { handoff_url: j.handoff_url! };
}

function claimContinuationReq(body: object): NextRequest {
  const h = new Headers({ "content-type": "application/json" });
  h.set(PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER, "cli");
  h.set(PRODUCT_ACTIVATION_CLI_VERSION_HEADER, cliSemver);
  return new NextRequest("http://127.0.0.1:3000/api/oss/claim-continuation", {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

function newClaimSecret(): string {
  return randomBytes(32).toString("hex");
}

describe.skipIf(!hasDatabaseUrl)("OSS claim ticket + handoff + redeem", () => {
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
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

  it("returns 200 JSON on insert; duplicate same body returns same handoff_url while handoff not consumed", async () => {
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
    const u1 = await expectTicket200(body);
    const rows = await db.select().from(ossClaimTickets);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.telemetrySource).toBe("legacy_unattributed");
    expect(rows[0]!.handoffToken).toBeTruthy();
    expect(rows[0]!.handoffConsumedAt).toBeNull();

    const u2 = await expectTicket200(body);
    expect(u2.handoff_url).toBe(u1.handoff_url);
    const rows2 = await db.select().from(ossClaimTickets);
    expect(rows2).toHaveLength(1);
  });

  it("returns 200 for v2 body and persists telemetry_source", async () => {
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
    await expectTicket200(body);
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

  it("legacy GET /api/oss/claim-handoff returns 308 to /verify/link with same h", async () => {
    const secret = newClaimSecret();
    const body = {
      claim_secret: secret,
      run_id: "run-legacy-308",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    const { handoff_url } = await expectTicket200(body);
    const h = hFromHandoffUrl(handoff_url);
    const leg = await getClaimHandoffLegacy(claimHandoffLegacyReq(h));
    expect(leg.status).toBe(308);
    const loc = leg.headers.get("location");
    expect(loc).toBeTruthy();
    expect(loc!).toContain("/verify/link?");
    expect(new URL(loc!).searchParams.get("h")).toBe(h);
  });

  it("claim-continuation sets browser_open_invoked_at once for interactive_human ticket", async () => {
    const secret = newClaimSecret();
    const body = {
      schema_version: 2 as const,
      telemetry_source: "unknown" as const,
      interactive_human: true,
      claim_secret: secret,
      run_id: "run-continuation-1",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    await expectTicket200(body);
    const c1 = await postClaimContinuation(claimContinuationReq({ claim_secret: secret }));
    expect(c1.status).toBe(204);
    const c2 = await postClaimContinuation(claimContinuationReq({ claim_secret: secret }));
    expect(c2.status).toBe(204);
    const rows = await db.select().from(ossClaimTickets).where(eq(ossClaimTickets.runId, "run-continuation-1"));
    expect(rows[0]!.browserOpenInvokedAt).not.toBeNull();
    expect(rows[0]!.interactiveHumanClaim).toBe(true);
  });

  it("claim-continuation returns 403 when interactive_human is false", async () => {
    const secret = newClaimSecret();
    const body = {
      schema_version: 2 as const,
      telemetry_source: "unknown" as const,
      claim_secret: secret,
      run_id: "run-no-continuation",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    await expectTicket200(body);
    const c = await postClaimContinuation(claimContinuationReq({ claim_secret: secret }));
    expect(c.status).toBe(403);
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
    for (let i = 0; i < OSS_CLAIM_TICKET_IP_CAP; i++) {
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
      expect(res.status).toBe(200);
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
    const overJ = (await over.json()) as Record<string, unknown>;
    expect(overJ.code).toBe("RATE_LIMITED");
    expect(overJ.type).toContain("/problems/");
    expect(over.headers.get("x-request-id")).toBeTruthy();
  });

  it("redeem: 200 twice same user; 409 other user; bogus 400 vs expired 400 problem bodies", async () => {
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
    await expectTicket200(body);

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
    const rid1 = r1.headers.get("x-request-id");
    expect(rid1).toBeTruthy();
    const j1 = (await r1.json()) as Record<string, string>;
    expect(j1.run_id).toBe("run-redeem-1");
    expect(j1.terminal_status).toBe("incomplete");

    const r2 = await postClaimRedeem(claimRedeemReq({ claim_secret: secret }));
    expect(r2.status).toBe(200);
    expect(r2.headers.get("x-request-id")).toBe(rid1);
    const j2 = (await r2.json()) as Record<string, string>;
    expect(j2.run_id).toBe("run-redeem-1");
    expect(j2.claimed_at).toBe(j1.claimed_at);

    authMock.mockResolvedValue({
      user: { id: u2!.id, email: "claim-b@example.com", name: null },
    });
    const r3 = await postClaimRedeem(claimRedeemReq({ claim_secret: secret }));
    expect(r3.status).toBe(409);
    const r3j = (await r3.json()) as Record<string, unknown>;
    expect(r3j.code).toBe("ALREADY_CLAIMED");
    expect(r3.headers.get("x-request-id")).toBe(rid1);

    const bogus = await postClaimRedeem(claimRedeemReq({ claim_secret: newClaimSecret() }));
    expect(bogus.status).toBe(400);
    const bogusJ = (await bogus.json()) as Record<string, unknown>;
    expect(bogusJ.code).toBe("CLAIM_FAILED");

    const secretExpired = newClaimSecret();
    await expectTicket200({
      claim_secret: secretExpired,
      run_id: "run-exp",
      issued_at: issuedNow(),
      terminal_status: "complete",
      workload_class: "non_bundled",
      subcommand: "batch_verify",
      build_profile: "oss",
    });
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
    const expJ = (await expRes.json()) as Record<string, unknown>;
    expect(expJ.code).toBe("CLAIM_EXPIRED");
    expect(expRes.headers.get("x-request-id")).toBeTruthy();

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
      ).toBe(200);
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
    ).toBe(200);

    const over = await postClaimRedeem(claimRedeemReq({ claim_secret: extraSecret }));
    expect(over.status).toBe(429);
    expect(await over.json()).toEqual({ code: "rate_limited", scope: "claim_redeem_user" });
  });

  it("duplicate POST after claimed returns 204", async () => {
    const secret = newClaimSecret();
    const body = {
      claim_secret: secret,
      run_id: "run-claimed-dup",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    await expectTicket200(body);
    const [u] = await db
      .insert(users)
      .values({ email: "dup-204@example.com", emailVerified: new Date() })
      .returning();
    authMock.mockResolvedValue({
      user: { id: u!.id, email: "dup-204@example.com", name: null },
    });
    await postClaimRedeem(claimRedeemReq({ claim_secret: secret }));
    const dup = await postClaimTicket(claimTicketReq(body));
    expect(dup.status).toBe(204);
    expect((await dup.text()).trim()).toBe("");
    expect(dup.headers.get("x-request-id")).toBeTruthy();
  });

  it("GET handoff: mint cookie + consumed; second GET same h is handoff_used; unknown h is handoff_invalid", async () => {
    const secret = newClaimSecret();
    const body = {
      claim_secret: secret,
      run_id: "run-handoff-1",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    const { handoff_url } = await expectTicket200(body);
    const h = hFromHandoffUrl(handoff_url);

    const g1 = await getVerifyLink(claimVerifyLinkReq(h));
    expect(g1.status).toBe(302);
    expect(g1.headers.get("location")).toBe(claimHandoffSigninRedirect());
    const pair = pendingCookiePairFromResponse(g1);
    expect(pair).toBeTruthy();

    const row1 = await db.select().from(ossClaimTickets).where(eq(ossClaimTickets.secretHash, hashOssClaimSecret(secret)));
    expect(row1[0]!.handoffConsumedAt).not.toBeNull();

    const g2 = await getVerifyLink(claimVerifyLinkReq(h));
    expect(g2.status).toBe(302);
    expect(g2.headers.get("location")).toContain("error=handoff_used");

    const gUnknown = await getVerifyLink(
      claimVerifyLinkReq("not-a-real-token-at-all-xxxxxxxxxxxx"),
    );
    expect(gUnknown.status).toBe(302);
    expect(gUnknown.headers.get("location")).toBe(claimHandoffErrorRedirect("handoff_invalid"));
  });

  it("after handoff consumed, duplicate POST rotates token; GET old h is invalid; GET new h mints once", async () => {
    const secret = newClaimSecret();
    const body = {
      claim_secret: secret,
      run_id: "run-rotate-1",
      issued_at: issuedNow(),
      terminal_status: "complete" as const,
      workload_class: "non_bundled" as const,
      subcommand: "batch_verify" as const,
      build_profile: "oss" as const,
    };
    const { handoff_url: u1 } = await expectTicket200(body);
    const h1 = hFromHandoffUrl(u1);
    await getVerifyLink(claimVerifyLinkReq(h1));

    const { handoff_url: u3 } = await expectTicket200(body);
    expect(u3).not.toBe(u1);
    const h3 = hFromHandoffUrl(u3);

    const stale = await getVerifyLink(claimVerifyLinkReq(h1));
    expect(stale.headers.get("location")).toBe(claimHandoffErrorRedirect("handoff_invalid"));

    const fresh1 = await getVerifyLink(claimVerifyLinkReq(h3));
    expect(fresh1.status).toBe(302);
    expect(fresh1.headers.get("location")).toBe(claimHandoffSigninRedirect());

    const fresh2 = await getVerifyLink(claimVerifyLinkReq(h3));
    expect(fresh2.headers.get("location")).toContain("error=handoff_used");
  });

  it("claim-handoff returns 429 after OSS_CLAIM_HANDOFF_IP_CAP GETs from same IP", async () => {
    const ip = "198.51.100.77";
    for (let i = 0; i < OSS_CLAIM_HANDOFF_IP_CAP; i++) {
      const res = await getVerifyLink(
        claimVerifyLinkReq(`invalid-token-${i}-${randomBytes(8).toString("hex")}`, ip),
      );
      expect(res.status).toBe(302);
    }
    const over = await getVerifyLink(claimVerifyLinkReq("one-more-invalid", ip));
    expect(over.status).toBe(429);
    const hj = (await over.json()) as Record<string, unknown>;
    expect(hj.code).toBe("RATE_LIMITED");
    expect(over.headers.get("x-request-id")).toBeTruthy();
  });

  it("redeem succeeds with pending cookie from GET /verify/link", async () => {
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
    const { handoff_url } = await expectTicket200(body);
    const pr = await getVerifyLink(claimVerifyLinkReq(hFromHandoffUrl(handoff_url)));
    expect(pr.status).toBe(302);
    const pair = pendingCookiePairFromResponse(pr);
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
