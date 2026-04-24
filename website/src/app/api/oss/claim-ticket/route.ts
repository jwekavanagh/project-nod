import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
import {
  ACTIVATION_PROBLEM_BASE,
  activationJsonWithId,
  activationNoContent,
  activationProblem,
  resolveActivationRequestId,
} from "@/lib/activationHttp";
import { extractClientIpKey } from "@/lib/magicLinkSendGate";
import {
  buildOssClaimHandoffUrlCanonical,
  OSS_CLAIM_HANDOFF_RESPONSE_SCHEMA_VERSION,
  type OssClaimTicketHandoffResponseBody,
} from "@/lib/ossClaimHandoffUrl";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
  PRODUCT_ACTIVATION_MAX_BODY_BYTES,
  PRODUCT_ACTIVATION_MAX_ISSUED_AT_SKEW_MS,
} from "@/lib/funnelProductActivationConstants";
import { cliVersionSchema } from "@/lib/funnelProductActivation.contract";
import { hashOssClaimSecret } from "@/lib/ossClaimSecretHash";
import { ossClaimTicketRequestSchema } from "@/lib/ossClaimTicketPayload";
import { expiresAtFromCreated } from "@/lib/ossClaimTicketTtl";
import { reserveClaimTicketIpSlot, withSerializableRetry } from "@/lib/ossClaimRateLimits";

export const runtime = "nodejs";

class RateLimitedClaimTicketIp extends Error {}

function newHandoffToken(): string {
  return randomBytes(32).toString("base64url");
}

function jsonHandoff(requestId: string, handoffToken: string): NextResponse {
  const body: OssClaimTicketHandoffResponseBody = {
    schema_version: OSS_CLAIM_HANDOFF_RESPONSE_SCHEMA_VERSION,
    handoff_url: buildOssClaimHandoffUrlCanonical(handoffToken),
  };
  return activationJsonWithId(requestId, body, 200);
}

function problemBadRequest(req: NextRequest, detail: string, code = "BAD_REQUEST"): NextResponse {
  return activationProblem(req, {
    status: 400,
    type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
    title: "Bad request",
    detail,
    code,
  });
}

function problemForbidden(req: NextRequest): NextResponse {
  return activationProblem(req, {
    status: 403,
    type: `${ACTIVATION_PROBLEM_BASE}/forbidden`,
    title: "Forbidden",
    detail: "This endpoint requires a supported AgentSkeptic CLI client.",
    code: "FORBIDDEN",
  });
}

function problemPayloadTooLarge(req: NextRequest): NextResponse {
  return activationProblem(req, {
    status: 413,
    type: `${ACTIVATION_PROBLEM_BASE}/payload-too-large`,
    title: "Payload too large",
    detail: "Request body exceeds the maximum allowed size.",
    code: "PAYLOAD_TOO_LARGE",
  });
}

function assertProductActivationBodySize(rawUtf8: string): void {
  const bytes = Buffer.byteLength(rawUtf8, "utf8");
  if (bytes > PRODUCT_ACTIVATION_MAX_BODY_BYTES) {
    const err = new Error("PAYLOAD_TOO_LARGE");
    (err as Error & { status: number }).status = 413;
    throw err;
  }
}

function validateIssuedAtSkew(issuedAt: string): boolean {
  const t = Date.parse(issuedAt);
  if (Number.isNaN(t)) return false;
  return Math.abs(Date.now() - t) <= PRODUCT_ACTIVATION_MAX_ISSUED_AT_SKEW_MS;
}

function assertCliHeaders(req: NextRequest): void {
  const product = req.headers.get(PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER)?.trim();
  const versionRaw = req.headers.get(PRODUCT_ACTIVATION_CLI_VERSION_HEADER)?.trim();
  if (product !== PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  const v = cliVersionSchema.safeParse(versionRaw);
  if (!v.success) {
    const err = new Error("FORBIDDEN");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawCt = req.headers.get("content-type");
  const ct = rawCt?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    return problemBadRequest(req, "Content-Type must be application/json.", "UNSUPPORTED_MEDIA_TYPE");
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > PRODUCT_ACTIVATION_MAX_BODY_BYTES) {
      return problemPayloadTooLarge(req);
    }
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return problemBadRequest(req, "Could not read request body.");
  }

  try {
    assertProductActivationBodySize(rawText);
  } catch (e) {
    if ((e as Error & { status?: number }).status === 413) {
      return problemPayloadTooLarge(req);
    }
    throw e;
  }

  try {
    assertCliHeaders(req);
  } catch (err) {
    const st = (err as Error & { status?: number }).status;
    if (st === 403) return problemForbidden(req);
    throw err;
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawText) as unknown;
  } catch {
    return problemBadRequest(req, "Invalid JSON.");
  }

  const parsed = ossClaimTicketRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return problemBadRequest(req, "Request body failed validation.", "VALIDATION_FAILED");
  }

  const body = parsed.data;
  if (!validateIssuedAtSkew(body.issued_at)) {
    return problemBadRequest(req, "issued_at is missing, invalid, or skewed too far from server time.", "ISSUED_AT_INVALID");
  }

  const secretHash = hashOssClaimSecret(body.claim_secret);
  const mintRequestId = resolveActivationRequestId(req);

  try {
    return await withSerializableRetry(async () =>
      db.transaction(
        async (tx) => {
          const existing = await tx
            .select()
            .from(ossClaimTickets)
            .where(eq(ossClaimTickets.secretHash, secretHash))
            .for("update");

          if (existing.length > 0) {
            const row = existing[0]!;
            const rid = row.activationRequestId;
            if (row.claimedAt !== null) {
              return activationNoContent(rid);
            }

            if (row.handoffConsumedAt === null) {
              let tok = row.handoffToken;
              if (!tok) {
                tok = newHandoffToken();
                await tx
                  .update(ossClaimTickets)
                  .set({ handoffToken: tok, handoffConsumedAt: null })
                  .where(eq(ossClaimTickets.secretHash, secretHash));
              }
              return jsonHandoff(rid, tok);
            }

            const rotated = newHandoffToken();
            await tx
              .update(ossClaimTickets)
              .set({
                handoffToken: rotated,
                handoffConsumedAt: null,
              })
              .where(eq(ossClaimTickets.secretHash, secretHash));
            return jsonHandoff(rid, rotated);
          }

          const ipKey = extractClientIpKey(req);
          const reserved = await reserveClaimTicketIpSlot(tx, ipKey);
          if (!reserved.ok) {
            throw new RateLimitedClaimTicketIp();
          }

          const createdAt = new Date();
          const telemetrySource =
            "schema_version" in body && body.schema_version === 2
              ? body.telemetry_source
              : "legacy_unattributed";
          const interactiveHumanClaim = body.interactive_human === true;

          let handoffToken = newHandoffToken();
          for (let attempt = 0; attempt < 8; attempt++) {
            try {
              await tx.insert(ossClaimTickets).values({
                secretHash,
                runId: body.run_id,
                terminalStatus: body.terminal_status,
                workloadClass: body.workload_class,
                subcommand: body.subcommand,
                buildProfile: body.build_profile,
                issuedAt: body.issued_at,
                telemetrySource,
                createdAt,
                expiresAt: expiresAtFromCreated(createdAt),
                handoffToken,
                handoffConsumedAt: null,
                interactiveHumanClaim,
                browserOpenInvokedAt: null,
                activationRequestId: mintRequestId,
              });
              return jsonHandoff(mintRequestId, handoffToken);
            } catch (e) {
              const code = (e as { code?: string }).code;
              if (code === "23505") {
                handoffToken = newHandoffToken();
                continue;
              }
              throw e;
            }
          }
          throw new Error("oss_claim_ticket: exhausted handoff_token uniqueness retries");
        },
        { isolationLevel: "serializable" },
      ),
    );
  } catch (e) {
    if (e instanceof RateLimitedClaimTicketIp) {
      return activationProblem(req, {
        status: 429,
        type: `${ACTIVATION_PROBLEM_BASE}/rate-limited`,
        title: "Too many requests",
        detail: "Claim ticket rate limit exceeded for this IP.",
        code: "RATE_LIMITED",
      });
    }
    console.error(e);
    return activationProblem(req, {
      status: 503,
      type: `${ACTIVATION_PROBLEM_BASE}/server-error`,
      title: "Service unavailable",
      detail: "Could not complete claim ticket. Try again later.",
      code: "SERVER_ERROR",
    });
  }
}
