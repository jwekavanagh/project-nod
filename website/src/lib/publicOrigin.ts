/**
 * Public browser origin for absolute URLs (e.g. share links), from proxy headers or Host.
 */
export function publicOriginFromHeaders(headers: Headers, fallbackOrigin: string): string {
  const xfHost = headers.get("x-forwarded-host");
  const host = xfHost?.split(",")[0]?.trim() || headers.get("host")?.trim();
  if (!host) {
    return fallbackOrigin.replace(/\/$/, "");
  }
  const xfProto = headers.get("x-forwarded-proto");
  const proto = (xfProto?.split(",")[0]?.trim() || "https").toLowerCase();
  const safeProto = proto === "http" || proto === "https" ? proto : "https";
  return `${safeProto}://${host}`;
}
