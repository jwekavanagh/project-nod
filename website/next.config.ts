import type { NextConfig } from "next";
import { createRequire } from "node:module";
import path from "path";
import { COMMERCIAL_SITE_SECURITY_HEADERS } from "./src/lib/httpSecurityHeaders";
import { DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS } from "./src/lib/demoVerifyOutputFileTracingGlobs";
import { REGISTRY_DRAFT_API_FILE_TRACING_GLOBS } from "./src/lib/registryDraft/registryDraftApiFileTracingGlobs";

const require = createRequire(import.meta.url);
require("../scripts/public-product-anchors.cjs").assertNextPublicOriginParity();

/**
 * `outputFileTracingRoot` helps Vercel/monorepo serverless traces include the repo root.
 * On Windows + OneDrive, tracing extra roots can worsen EBUSY locks during `next build`;
 * disable locally unless deploying (set NEXT_CONFIG_TRACE_ROOT=1) or building on Vercel.
 */
const vercelLike = process.env.VERCEL === "1" || process.env.VERCEL === "production" || Boolean(process.env.VERCEL);
const traceRoot =
  vercelLike || process.env.NEXT_CONFIG_TRACE_ROOT === "1" ? path.join(__dirname, "..") : undefined;

/**
 * Pin internal RSC webpack loaders to the resolved `next` package. In some environments
 * (workspace hoisting, skewed installs, or `next` CLI vs app version mismatch) webpack can
 * fail with: Can't resolve 'next-flight-client-entry-loader'. This mirrors Next's own
 * `resolveLoader.alias` mapping in `dist/build/webpack-config.js`.
 */
function pinNextFlightClientEntryLoader(config: Parameters<NonNullable<NextConfig["webpack"]>>[0]) {
  const nextDir = path.dirname(require.resolve("next/package.json"));
  const loaderPath = path.join(nextDir, "dist", "build", "webpack", "loaders", "next-flight-client-entry-loader");
  const prev = config.resolveLoader as { alias?: Record<string, string> } | undefined;
  config.resolveLoader = {
    ...config.resolveLoader,
    alias: {
      ...prev?.alias,
      "next-flight-client-entry-loader": loaderPath,
    },
  };
}

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/examples", destination: "/guides", permanent: true },
      { source: "/company", destination: "/support", permanent: true },
    ];
  },
  // Avoid leaking stack info (ZAP: "Server Leaks Information Via X-Powered-By").
  poweredByHeader: false,
  serverExternalPackages: ["nodemailer", "postgres", "agentskeptic"],
  ...(traceRoot ? { outputFileTracingRoot: traceRoot } : {}),
  /**
   * `agentskeptic` loads JSON Schemas and the demo reads `examples/*` via runtime `readFileSync` paths
   * that file tracing cannot infer. Without these globs, Vercel serverless bundles miss the assets and
   * the route returns a non-JSON 500 (the Try-it client then shows "Network error" from `response.json()`).
   */
  outputFileTracingIncludes: {
    "/api/demo/verify": [...DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS],
    "/api/integrator/registry-draft": [...REGISTRY_DRAFT_API_FILE_TRACING_GLOBS],
  },
  webpack: (config) => {
    pinNextFlightClientEntryLoader(config);
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: COMMERCIAL_SITE_SECURITY_HEADERS.map((h) => ({
          key: h.key,
          value: h.value,
        })),
      },
      {
        source: "/r/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
