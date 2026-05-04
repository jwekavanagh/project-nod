"use client";

import { FirstFiveMinutesCallout } from "@/components/FirstFiveMinutesCallout";
import { FunnelSurfaceBeacon } from "@/components/FunnelSurfaceBeacon";
import { resolveAttributionSurface } from "@/lib/attributionRoutePolicy";
import { usePathname } from "next/navigation";

/**
 * Funnel surface beacon: mounts before main content; must remount per pathname so
 * client navigations (e.g. / → /integrate) each fire the correct impression.
 */
export function SiteFunnelBeacon() {
  const pathname = usePathname() ?? "";
  const surface = resolveAttributionSurface(pathname);
  if (!surface) return null;
  return <FunnelSurfaceBeacon key={pathname} surface={surface} />;
}

/**
 * First-five-minutes + telemetry callout: mounts after `children` on beacon-eligible routes
 * so the homepage lead is product story, not policy detail.
 */
export function FirstFiveMinutesAfterMain() {
  const pathname = usePathname() ?? "";
  const basePath = pathname.replace(/\/+$/, "") || "/";
  if (
    basePath === "/guides" ||
    basePath === "/pricing" ||
    basePath === "/security" ||
    basePath === "/privacy" ||
    basePath === "/terms"
  )
    return null;
  const surface = resolveAttributionSurface(pathname);
  if (!surface) return null;
  return <FirstFiveMinutesCallout homeTeaser={pathname === "/"} />;
}
