import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { ossClaimTickets } from "@/db/schema";
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
    return new NextResponse(null, { status: 400 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > PRODUCT_ACTIVATION_MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (Buffer.byteLength(rawText, "utf8") > PRODUCT_ACTIVATION_MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  try {
    assertCliHeaders(req);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    if (st === 403) return new NextResponse(null, { status: 403 });
    throw e;
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawText) as unknown;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = bodySchema.safeParse(jsonBody);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
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
            return NextResponse.json({ code: "claim_failed" }, { status: 400 });
          }

          const row = rows[0]!;
          if (!row.interactiveHumanClaim) {
            return NextResponse.json({ code: "continuation_not_applicable" }, { status: 403 });
          }

          const now = new Date();
          if (row.expiresAt.getTime() < now.getTime()) {
            return NextResponse.json({ code: "claim_failed" }, { status: 400 });
          }

          if (row.browserOpenInvokedAt !== null) {
            return new NextResponse(null, { status: 204 });
          }

          await tx
            .update(ossClaimTickets)
            .set({ browserOpenInvokedAt: now })
            .where(eq(ossClaimTickets.secretHash, secretHash));

          return new NextResponse(null, { status: 204 });
        },
        { isolationLevel: "serializable" },
      ),
    );
  } catch (e) {
    console.error(e);
    return new NextResponse(null, { status: 503 });
  }
}
