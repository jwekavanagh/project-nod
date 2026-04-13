import { funnelSurfaceImpressionSchema } from "@/lib/funnelSurfaceImpression.contract";
import { isFunnelSurfaceRequestOriginAllowed } from "@/lib/funnelRequestOriginAllowed";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const event =
    parsed.data.surface === "acquisition" ? "acquisition_landed" : "integrate_landed";

  await logFunnelEvent({
    event,
    userId: null,
    metadata: { schema_version: 1 as const, surface: parsed.data.surface },
  });

  return new NextResponse(null, { status: 204 });
}
