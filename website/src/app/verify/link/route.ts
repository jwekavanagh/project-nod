import { NextRequest } from "next/server";
import { runOssClaimHandoffGet } from "@/lib/runOssClaimHandoffGet";

export const runtime = "nodejs";

/** Steady-state OSS claim handoff: mints pending cookie and records `handoff_consumed_at`. */
export async function GET(req: NextRequest) {
  return runOssClaimHandoffGet(req);
}
