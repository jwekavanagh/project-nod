import { auth } from "@/auth";
import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";

type AuthedRequest = NextRequest & { auth: Session | null };

/**
 * Unauthenticated `/account` hits used `redirect()` from a Server Component, which can
 * produce a 3xx with a large RSC body and trip ZAP "Big Redirect" (10044-1).
 * Handle that redirect here so the response body stays minimal.
 *
 * Uses the NextAuth middleware wrapper so the session is resolved from this request’s
 * cookies (a bare `auth()` call relies on `headers()` and is not reliable in proxy).
 */
export default auth((req: AuthedRequest) => {
  if (req.auth?.user?.id) {
    return NextResponse.next();
  }
  const url = req.nextUrl.clone();
  url.pathname = "/auth/signin";
  url.search = "";
  url.searchParams.set("callbackUrl", "/account");
  return NextResponse.redirect(url);
});

export const config = {
  matcher: "/account/:path*",
};
