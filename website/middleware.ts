import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  buildCommercialSiteContentSecurityPolicy,
  COMMERCIAL_SITE_CSP_NONCE_HEADER,
} from "./src/lib/httpSecurityHeaders";
import { xRobotsTagValueForVercelPreview } from "./src/lib/previewVercelNoindexHeader";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const allowEval = process.env.NODE_ENV !== "production";
  const isHttps = request.nextUrl.protocol === "https:";
  const csp = buildCommercialSiteContentSecurityPolicy(nonce, {
    allowEval,
    upgradeInsecureRequests: isHttps,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set(COMMERCIAL_SITE_CSP_NONCE_HEADER, nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  const previewRobots = xRobotsTagValueForVercelPreview();
  if (previewRobots) {
    response.headers.set("X-Robots-Tag", previewRobots);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
