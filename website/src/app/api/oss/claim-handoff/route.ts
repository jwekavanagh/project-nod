import { NextRequest } from "next/server";
import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";
import { activationRedirect } from "@/lib/activationHttp";
import { claimHandoffErrorRedirect } from "@/lib/ossClaimHandoffUrl";

export const runtime = "nodejs";

const MAX_HANDOFF_QUERY_LEN = 256;

/**
 * Legacy entrypoint: **308** to first-party `/verify/link?h=` (no DB / no cookie here).
 * Handoff semantics live on `GET /verify/link`.
 */
export async function GET(req: NextRequest) {
  const hRaw = req.nextUrl.searchParams.get("h");
  const h = hRaw?.trim() ?? "";
  if (h.length === 0 || h.length > MAX_HANDOFF_QUERY_LEN) {
    return activationRedirect(req, claimHandoffErrorRedirect("handoff_invalid"), 308);
  }

  const base = getCanonicalSiteOrigin().replace(/\/$/, "");
  return activationRedirect(req, `${base}/verify/link?h=${encodeURIComponent(h)}`, 308);
}
