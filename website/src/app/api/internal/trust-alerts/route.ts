import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { runTrustAlertsCron } from "@/lib/runTrustAlertsCron";

/** Cron-invoked digest for **`trust_decision_blocked`** funnel spikes. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return false;
  }
  return auth.slice(7).trim() === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const result = await runTrustAlertsCron();
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
