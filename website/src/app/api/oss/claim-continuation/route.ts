import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
import {
  ACTIVATION_PROBLEM_BASE,
  activationNoContent,
  activationProblem,
  activationProblemWithId,
} from "@/lib/activationHttp";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
  PRODUCT_ACTIVATION_MAX_BODY_BYTES,
} from "@/lib/funnelProductActivationConstants";
import { cliVersionSchema } from "@/lib/funnelProductActivation.contract";
import { hashOssClaimSecret } from "@/lib/ossClaimSecretHash";
import { withSerializableRetry } from "@/lib/ossClaimRateLimits";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    claim_secret: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

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
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Content-Type must be application/json.",
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > PRODUCT_ACTIVATION_MAX_BODY_BYTES) {
      return activationProblem(req, {
        status: 413,
        type: `${ACTIVATION_PROBLEM_BASE}/payload-too-large`,
        title: "Payload too large",
        detail: "Request body exceeds the maximum allowed size.",
        code: "PAYLOAD_TOO_LARGE",
      });
    }
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Could not read request body.",
      code: "BAD_REQUEST",
    });
  }

  if (Buffer.byteLength(rawText, "utf8") > PRODUCT_ACTIVATION_MAX_BODY_BYTES) {
    return activationProblem(req, {
      status: 413,
      type: `${ACTIVATION_PROBLEM_BASE}/payload-too-large`,
      title: "Payload too large",
      detail: "Request body exceeds the maximum allowed size.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  try {
    assertCliHeaders(req);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    if (st === 403) {
      return activationProblem(req, {
        status: 403,
        type: `${ACTIVATION_PROBLEM_BASE}/forbidden`,
        title: "Forbidden",
        detail: "This endpoint requires a supported AgentSkeptic CLI client.",
        code: "FORBIDDEN",
      });
    }
    throw e;
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawText) as unknown;
  } catch {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Invalid JSON.",
      code: "INVALID_JSON",
    });
  }

  const parsed = bodySchema.safeParse(jsonBody);
  if (!parsed.success) {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Request body failed validation.",
      code: "VALIDATION_FAILED",
    });
  }

  const secretHash = hashOssClaimSecret(parsed.data.claim_secret);

  try {
    return await withSerializableRetry(async () =>
      db.transaction(
        async (tx) => {
          const rows = await tx
            .select()
            .from(ossClaimTickets)
            .where(eq(ossClaimTickets.secretHash, secretHash))
            .for("update");

          if (rows.length === 0) {
            return activationProblem(req, {
              status: 400,
              type: `${ACTIVATION_PROBLEM_BASE}/claim-failed`,
              title: "Claim failed",
              detail: "No claim ticket matches this secret.",
              code: "CLAIM_FAILED",
            });
          }

          const row = rows[0]!;
          const rid = row.activationRequestId;
          if (!row.interactiveHumanClaim) {
            return activationProblemWithId(rid, {
              status: 403,
              type: `${ACTIVATION_PROBLEM_BASE}/continuation-not-applicable`,
              title: "Not applicable",
              detail: "Browser continuation is only recorded for interactive-human claim tickets.",
              code: "CONTINUATION_NOT_APPLICABLE",
            });
          }

          const now = new Date();
          if (row.expiresAt.getTime() < now.getTime()) {
            return activationProblemWithId(rid, {
              status: 400,
              type: `${ACTIVATION_PROBLEM_BASE}/claim-failed`,
              title: "Claim failed",
              detail: "This claim ticket has expired.",
              code: "CLAIM_EXPIRED",
            });
          }

          if (row.browserOpenInvokedAt !== null) {
            return activationNoContent(rid);
          }

          await tx
            .update(ossClaimTickets)
            .set({ browserOpenInvokedAt: now })
            .where(eq(ossClaimTickets.secretHash, secretHash));

          return activationNoContent(rid);
        },
        { isolationLevel: "serializable" },
      ),
    );
  } catch (e) {
    console.error(e);
    return activationProblem(req, {
      status: 503,
      type: `${ACTIVATION_PROBLEM_BASE}/server-error`,
      title: "Service unavailable",
      detail: "Could not record continuation. Try again later.",
      code: "SERVER_ERROR",
    });
  }
}
