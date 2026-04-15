import { funnelSurfaceImpressionSchema } from "@/lib/funnelSurfaceImpression.contract";
import { isFunnelSurfaceRequestOriginAllowed } from "@/lib/funnelRequestOriginAllowed";
import {
  normalizeFunnelSurfaceAttribution,
  resolveFunnelAnonId,
} from "@/lib/funnelAttribution";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { telemetryCoreWriteFreezeActive } from "@/lib/telemetryWritesConfig";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (telemetryCoreWriteFreezeActive()) {
    return new NextResponse(null, { status: 503 });
  }

  if (!isFunnelSurfaceRequestOriginAllowed(req)) {
    return new NextResponse(null, { status: 403 });
  }

  const rawCt = req.headers.get("content-type");
  const ct = rawCt?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    return new NextResponse(null, { status: 400 });
  }

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = funnelSurfaceImpressionSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  let attribution: Record<string, string>;
  try {
    attribution = normalizeFunnelSurfaceAttribution(parsed.data.attribution) as Record<
      string,
      string
    >;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const funnelAnonId = parsed.data.funnel_anon_id ?? resolveFunnelAnonId(undefined);

  const event =
    parsed.data.surface === "acquisition" ? "acquisition_landed" : "integrate_landed";

  await logFunnelEvent({
    event,
    userId: null,
    metadata: {
      schema_version: 1 as const,
      surface: parsed.data.surface,
      funnel_anon_id: funnelAnonId,
      attribution,
    },
  });

  return NextResponse.json(
    { schema_version: 1 as const, funnel_anon_id: funnelAnonId },
    { status: 200 },
  );
}
