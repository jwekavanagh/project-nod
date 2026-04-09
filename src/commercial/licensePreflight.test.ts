import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLI_OPERATIONAL_CODES } from "../cliOperationalCodes.js";
import { TruthLayerError } from "../truthLayerError.js";
import { runLicensePreflightIfNeeded } from "./licensePreflight.js";

vi.mock("../generated/commercialBuildFlags.js", () => ({
  LICENSE_PREFLIGHT_ENABLED: true,
  LICENSE_API_BASE_URL: "https://license.example.com",
}));

describe("runLicensePreflightIfNeeded", () => {
  const origKey = process.env.WORKFLOW_VERIFIER_API_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    if (origKey === undefined) delete process.env.WORKFLOW_VERIFIER_API_KEY;
    else process.env.WORKFLOW_VERIFIER_API_KEY = origKey;
  });

  it("throws LICENSE_KEY_MISSING when key unset", async () => {
    delete process.env.WORKFLOW_VERIFIER_API_KEY;
    await expect(runLicensePreflightIfNeeded()).rejects.toMatchObject({
      code: CLI_OPERATIONAL_CODES.LICENSE_KEY_MISSING,
    });
  });

  it("returns when server allows", async () => {
    process.env.WORKFLOW_VERIFIER_API_KEY = "wf_sk_live_test";
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ allowed: true, plan: "starter", limit: 100, used: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await runLicensePreflightIfNeeded();
    expect(fetch).toHaveBeenCalled();
  });

  it("throws LICENSE_DENIED on 403 body", async () => {
    process.env.WORKFLOW_VERIFIER_API_KEY = "wf_sk_live_test";
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ allowed: false, code: "QUOTA_EXCEEDED", message: "Cap hit" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    await expect(runLicensePreflightIfNeeded()).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof TruthLayerError &&
        e.code === CLI_OPERATIONAL_CODES.LICENSE_DENIED &&
        e.message.includes("Cap hit"),
    );
  });
});
