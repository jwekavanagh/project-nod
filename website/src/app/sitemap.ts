import marketing from "@/lib/marketing";
import { lastModifiedForSitemapPath } from "@/lib/sitemapPathLastModified";
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
    marketing.slug,
    ...discoveryPaths,
    "/integrate",
    "/guides",
    "/problems",
    "/compare",
    "/support",
    "/contact",
    "/pricing",
    "/security",
    "/privacy",
    "/terms",
    "/openapi-commercial-v1.yaml",
    "/llms.txt",
  ];
  return paths.map((p) => {
    const lastModified = lastModifiedForSitemapPath(p);
    if (lastModified) {
      return { url: abs(p), lastModified };
    }
    return { url: abs(p) };
  });
}
