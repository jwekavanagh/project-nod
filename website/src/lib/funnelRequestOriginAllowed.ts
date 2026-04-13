import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";
import type { NextRequest } from "next/server";

/**
 * True when Origin or Referer matches the canonical site origin (same policy as getCanonicalSiteOrigin).
 */
export function isFunnelSurfaceRequestOriginAllowed(req: NextRequest): boolean {
  let canonical: string;
  try {
    canonical = getCanonicalSiteOrigin();
  } catch {
    return false;
  }

  const originHeader = req.headers.get("origin");
  if (originHeader) {
    try {
      if (new URL(originHeader).origin === canonical) return true;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin === canonical) return true;
    } catch {
      return false;
    }
  }

  return false;
}
