import type { NextRequest } from "next/server";
import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "@/lib/funnelProductActivationConstants";
import { cliVersionSchema } from "@/lib/funnelProductActivation.contract";
import { isFunnelSurfaceRequestOriginAllowed } from "@/lib/funnelRequestOriginAllowed";

/**
 * Browser same-origin requests, or CLI requests with product/version headers (no Origin on fetch).
 */
export function isPublicFunnelAnonRequestAllowed(req: NextRequest): boolean {
  if (isFunnelSurfaceRequestOriginAllowed(req)) return true;
  const product = req.headers.get(PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER)?.trim();
  const versionRaw = req.headers.get(PRODUCT_ACTIVATION_CLI_VERSION_HEADER)?.trim();
  if (product !== PRODUCT_ACTIVATION_CLI_PRODUCT_VALUE) return false;
  return cliVersionSchema.safeParse(versionRaw).success;
}

/** Throws if canonical origin cannot be resolved (production misconfig). */
export function assertCanonicalOriginResolvable(): void {
  getCanonicalSiteOrigin();
}
