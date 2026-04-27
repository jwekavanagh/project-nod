import { statSync } from "node:fs";
import { join } from "node:path";
import marketing from "@/lib/marketing";

function mtimeFile(cwd: string, relative: string): Date | undefined {
  try {
    return statSync(join(cwd, relative)).mtime;
  } catch {
    return undefined;
  }
}

const STATIC_ROUTE_TO_SOURCE: Readonly<Record<string, string>> = {
  "/": "src/app/page.tsx",
  "/integrate": "src/app/integrate/page.tsx",
  "/guides": "src/app/guides/page.tsx",
  "/problems": "src/app/problems/page.tsx",
  "/compare": "src/app/compare/page.tsx",
  "/support": "src/app/support/page.tsx",
  "/contact": "src/app/contact/page.tsx",
  "/pricing": "src/app/pricing/page.tsx",
  "/security": "src/app/security/page.tsx",
  "/privacy": "src/app/privacy/page.tsx",
  "/terms": "src/app/terms/page.tsx",
  [marketing.slug]: "src/app/database-truth-vs-traces/page.tsx",
  "/openapi-commercial-v1.yaml": "src/app/openapi-commercial-v1.yaml/route.ts",
  "/llms.txt": "src/app/llms.txt/route.ts",
};

const discoveryRouteRe = /^\/(guides|compare|examples)\/([a-z0-9-]+)$/;

/**
 * Best-effort `lastModified` for a sitemap path: static route source, acquisition page, or surface markdown mtime.
 */
export function lastModifiedForSitemapPath(path: string, cwd: string = process.cwd()): Date | undefined {
  const fromStatic = STATIC_ROUTE_TO_SOURCE[path];
  if (fromStatic) {
    return mtimeFile(cwd, fromStatic);
  }
  const m = path.match(discoveryRouteRe);
  if (m) {
    const segment = m[1];
    const slug = m[2];
    return mtimeFile(cwd, join("content", "surfaces", segment, `${slug}.md`));
  }
  return undefined;
}
