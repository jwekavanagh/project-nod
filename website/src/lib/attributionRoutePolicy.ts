/**
 * Audited allowlist for funnel surface beacons (acquisition / integrate).
 * New marketing routes must be added here explicitly — default is no beacon (fail closed).
 */

const ACQUISITION_EXACT_PATHS = new Set<string>([
  "/",
  "/database-truth-vs-traces",
  "/pricing",
  "/support",
  "/security",
  "/terms",
  "/privacy",
  "/claim",
  "/verify",
  "/verify/link",
  "/examples/wf-complete",
  "/examples/wf-missing",
]);

/** Pathname prefixes that must never emit surface beacons */
const NO_BEACON_PREFIXES = ["/account", "/auth", "/r"] as const;

const INTEGRATE_EXACT = "/integrate";

function normalizePathname(pathname: string): string | null {
  const t = pathname.trim();
  if (t === "" || t === "/") return t === "/" ? "/" : null;
  const noQuery = t.split("?")[0]!.split("#")[0]!;
  if (noQuery === "") return null;
  const withSlash = noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") || "/" : withSlash;
}

function isNoBeaconPath(path: string): boolean {
  for (const p of NO_BEACON_PREFIXES) {
    if (path === p || path.startsWith(`${p}/`)) return true;
  }
  return false;
}

function isGuidesAcquisitionPath(path: string): boolean {
  return path === "/guides" || path.startsWith("/guides/");
}

/**
 * Resolve which funnel surface beacon should fire for a Next.js pathname, or null if none.
 */
export function resolveAttributionSurface(pathname: string): "acquisition" | "integrate" | null {
  const path = normalizePathname(pathname);
  if (path === null) return null;
  if (isNoBeaconPath(path)) return null;
  if (path === INTEGRATE_EXACT) return "integrate";
  if (ACQUISITION_EXACT_PATHS.has(path) || isGuidesAcquisitionPath(path)) return "acquisition";
  return null;
}
