import discoveryAcquisition from "@/lib/discoveryAcquisition";
import { listDiscoveryRoutes } from "@/lib/surfaceMarkdown";
import { publicProductAnchors } from "@/lib/publicProductAnchors";
import type { MetadataRoute } from "next";

function abs(path: string): string {
  const base = publicProductAnchors.productionCanonicalOrigin.replace(/\/$/, "");
  return path === "" || path === "/" ? `${base}/` : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const discoveryPaths = listDiscoveryRoutes();
  const paths = [
    "/",
    discoveryAcquisition.slug,
    ...discoveryPaths,
    "/integrate",
    "/guides",
    "/problems",
    "/compare",
    "/support",
    "/pricing",
    "/security",
    "/privacy",
    "/terms",
    "/openapi-commercial-v1.yaml",
    "/llms.txt",
  ];
  const now = new Date();
  return paths.map((p) => ({
    url: abs(p),
    lastModified: now,
  }));
}
