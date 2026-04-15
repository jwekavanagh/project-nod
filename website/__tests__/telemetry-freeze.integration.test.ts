import { POST as postDemoVerify } from "@/app/api/demo/verify/route";
import { POST as postProductActivation } from "@/app/api/funnel/product-activation/route";
import { POST as postSurface } from "@/app/api/funnel/surface-impression/route";
import { DEMO_ERROR_CODES } from "@/lib/demoVerify.contract";
import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";
import {
  PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER,
  PRODUCT_ACTIVATION_CLI_VERSION_HEADER,
} from "@/lib/funnelProductActivationConstants";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
const hasTelemetryUrl = Boolean(process.env.TELEMETRY_DATABASE_URL?.trim());

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootPkgPath = join(__dirname, "..", "..", "package.json");
const cliSemver = JSON.parse(readFileSync(rootPkgPath, "utf8")).version as string;

describe.skipIf(!hasDatabaseUrl || !hasTelemetryUrl)("telemetry core write freeze", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 on product-activation, surface-impression, and demo/verify when freeze is on", async () => {
    vi.stubEnv("AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE", "1");

    const h = new Headers({ "content-type": "application/json" });
    h.set(PRODUCT_ACTIVATION_CLI_PRODUCT_HEADER, "cli");
    h.set(PRODUCT_ACTIVATION_CLI_VERSION_HEADER, cliSemver);
    const pa = await postProductActivation(
      new NextRequest("http://127.0.0.1/api/funnel/product-activation", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          event: "verify_started",
          schema_version: 1,
          run_id: "freeze-test-run",
          issued_at: new Date().toISOString(),
          workload_class: "non_bundled",
          subcommand: "batch_verify",
          build_profile: "oss",
        }),
      }),
    );
    expect(pa.status).toBe(503);

    const canonical = getCanonicalSiteOrigin();
    const surfHeaders = new Headers({ "content-type": "application/json" });
    if (canonical) surfHeaders.set("origin", canonical);
    const surf = await postSurface(
      new NextRequest("http://127.0.0.1/api/funnel/surface-impression", {
        method: "POST",
        headers: surfHeaders,
        body: JSON.stringify({
          surface: "acquisition",
          attribution: { landing_path: "/" },
        }),
      }),
    );
    expect(surf.status).toBe(503);

    const demo = await postDemoVerify(
      new NextRequest("http://127.0.0.1/api/demo/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId: "wf_complete" }),
      }),
    );
    expect(demo.status).toBe(503);
    const j = (await demo.json()) as { ok: boolean; error: string };
    expect(j.ok).toBe(false);
    expect(j.error).toBe(DEMO_ERROR_CODES.UNAVAILABLE);
  });
});
