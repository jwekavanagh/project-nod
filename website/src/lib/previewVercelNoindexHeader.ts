/**
 * Vercel sets `VERCEL_ENV` to `preview` on preview deployments. Use this to avoid
 * preview URLs entering the public index; HTTP header is harder for page-level metadata to override.
 */
export const PREVIEW_X_ROBOTS_NOINDEX = "noindex, nofollow";

export function xRobotsTagValueForVercelPreview(): string | null {
  if (process.env.VERCEL_ENV === "preview") {
    return PREVIEW_X_ROBOTS_NOINDEX;
  }
  return null;
}
