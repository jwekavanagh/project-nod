import type { NextConfig } from "next";
import { createRequire } from "node:module";
import path from "path";

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

const nextConfig: NextConfig = {
  serverExternalPackages: ["nodemailer", "postgres", "workflow-verifier"],
  ...(traceRoot ? { outputFileTracingRoot: traceRoot } : {}),
  async headers() {
    return [
      {
        source: "/r/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
