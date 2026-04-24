"use client";

import { FirstFiveMinutesCallout } from "@/components/FirstFiveMinutesCallout";
import { FunnelSurfaceBeacon } from "@/components/FunnelSurfaceBeacon";
import { resolveAttributionSurface } from "@/lib/attributionRoutePolicy";
import { usePathname } from "next/navigation";

/**
 * Single layout owner for funnel surface impressions. Remounts per pathname so
 * client navigations (e.g. / → /integrate) each fire the correct beacon.
 */
export function SiteFunnelAttribution() {
  const pathname = usePathname() ?? "";
  const surface = resolveAttributionSurface(pathname);
  if (!surface) return null;
  return (
    <div className="site-funnel-attribution-root" data-testid="site-funnel-attribution-root">
      <FunnelSurfaceBeacon key={pathname} surface={surface} />
      <FirstFiveMinutesCallout />
    </div>
  );
}
