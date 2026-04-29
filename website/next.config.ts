import type { NextConfig } from "next";
import path from "path";
import { COMMERCIAL_SITE_SECURITY_HEADERS } from "./src/lib/httpSecurityHeaders";
import { DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS } from "./src/lib/demoVerifyOutputFileTracingGlobs";
import { REGISTRY_DRAFT_API_FILE_TRACING_GLOBS } from "./src/lib/registryDraft/registryDraftApiFileTracingGlobs";

import { createRequire } from "node:module";

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
 * Root `overrides` replace `node-domexception` with `file:./internal-packages/node-domexception-native`.
 * npm can record that link relative to `fetch-blob` (e.g. `node_modules/fetch-blob/internal-packages/...`),
 * which does not exist inside the published tarball, so webpack fails with "Can't resolve 'node-domexception'"
 * when bundling server code that pulls `node-fetch` → `fetch-blob`. Alias to the real package path.
 */
const nodeDomExceptionShim = path.join(__dirname, "../internal-packages/node-domexception-native");

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
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve ??= {};
      const prev = config.resolve.alias;
      const merged =
        prev && typeof prev === "object" && !Array.isArray(prev)
          ? { ...prev, "node-domexception": nodeDomExceptionShim }
          : { "node-domexception": nodeDomExceptionShim };
      config.resolve.alias = merged;
    }
    return config;
  },
  ...(traceRoot ? { outputFileTracingRoot: traceRoot } : {}),
  /**
   * `agentskeptic` loads JSON Schemas and the demo reads `examples/*` via runtime `readFileSync` paths
   * that file tracing cannot infer. Without these globs, Vercel serverless bundles miss the assets and
   * the route returns a non-JSON 500 (the Try-it client then shows "Network error" from `response.json()`).
   */
  outputFileTracingIncludes: {
    "/api/demo/verify": [...DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS],
    "/api/verify": [...DEMO_VERIFY_OUTPUT_FILE_TRACING_GLOBS],
    "/api/integrator/registry-draft": [...REGISTRY_DRAFT_API_FILE_TRACING_GLOBS],
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
