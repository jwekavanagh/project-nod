import { dbTelemetry } from "@/db/telemetryClient";
import {
  telemetryProductActivationOutcomeBeacons,
  telemetryProductActivationStartedBeacons,
} from "@/db/telemetrySchema";
import { logFunnelEvent } from "@/lib/funnelEvent";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
  PRODUCT_ACTIVATION_MAX_BODY_BYTES,
  PRODUCT_ACTIVATION_MAX_ISSUED_AT_SKEW_MS,
} from "@/lib/funnelProductActivationConstants";
import {
  cliVersionSchema,
  productActivationRequestSchema,
} from "@/lib/funnelProductActivation.contract";
import {
  rowMetadataVerifyOutcome,
  rowMetadataVerifyStarted,
} from "@/lib/funnelProductActivationMetadata";
import { telemetryCoreWriteFreezeActive } from "@/lib/telemetryWritesConfig";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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
  if (telemetryCoreWriteFreezeActive()) {
    return new NextResponse(null, { status: 503 });
  }

  if (!process.env.TELEMETRY_DATABASE_URL?.trim()) {
    console.error("[product-activation] TELEMETRY_DATABASE_URL is required");
    return new NextResponse(null, { status: 503 });
  }

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

  try {
    assertProductActivationBodySize(rawText);
  } catch (e) {
    if ((e as Error & { status?: number }).status === 413) {
      return new NextResponse(null, { status: 413 });
    }
    throw e;
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

  const parsed = productActivationRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  const body = parsed.data;
  if (!validateIssuedAtSkew(body.issued_at)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    if (body.event === "verify_started") {
      await dbTelemetry.transaction(async (tx) => {
        const inserted = await tx
          .insert(telemetryProductActivationStartedBeacons)
          .values({ runId: body.run_id })
          .onConflictDoNothing()
          .returning({ runId: telemetryProductActivationStartedBeacons.runId });

        if (inserted.length === 0) {
          return;
        }

        await logFunnelEvent(
          {
            event: "verify_started",
            userId: null,
            installId: body.install_id ?? null,
            metadata: rowMetadataVerifyStarted(body),
          },
          tx,
          { telemetryTierDestination: "telemetry" },
        );
      });
    } else {
      await dbTelemetry.transaction(async (tx) => {
        const inserted = await tx
          .insert(telemetryProductActivationOutcomeBeacons)
          .values({ runId: body.run_id })
          .onConflictDoNothing()
          .returning({ runId: telemetryProductActivationOutcomeBeacons.runId });

        if (inserted.length === 0) {
          return;
        }

        await logFunnelEvent(
          {
            event: "verify_outcome",
            userId: null,
            installId: body.install_id ?? null,
            metadata: rowMetadataVerifyOutcome(body),
          },
          tx,
          { telemetryTierDestination: "telemetry" },
        );
      });
    }
  } catch (e) {
    console.error(e);
    return new NextResponse(null, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
