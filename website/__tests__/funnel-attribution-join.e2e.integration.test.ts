import { POST as postSurface } from "@/app/api/funnel/surface-impression/route";
import { truncateCommercialFixtureDbs } from "./helpers/truncateCommercialFixture";
import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { surfaceImpressionPostRequest } from "./helpers/funnelApiRequests";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/stripeServer", () => ({
  getStripe: vi.fn(),
}));

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
const hasTelemetryDb = Boolean(process.env.TELEMETRY_DATABASE_URL?.trim());

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const distRunFunnelAnon = join(repoRoot, "dist", "cli", "runFunnelAnonSet.js");
const distPostProductActivation = join(repoRoot, "dist", "telemetry", "postProductActivationEvent.js");
const distResetInstall = join(repoRoot, "dist", "telemetry", "cliInstallId.js");

function setSandboxHome(home: string): void {
  process.env.HOME = home;
  if (process.platform === "win32") {
    process.env.USERPROFILE = home;
  }
}

function restoreSandboxHome(): void {
  delete process.env.HOME;
  if (process.platform === "win32") {
    delete process.env.USERPROFILE;
  }
}

describe.skipIf(!hasDatabaseUrl || !hasTelemetryDb)("funnel attribution join — end-to-end", () => {
  beforeEach(async () => {
    vi.stubEnv("AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB", "1");
    await truncateCommercialFixtureDbs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    restoreSandboxHome();
  });

  it("surface-minted funnel_anon_id → funnel-anon set → activation payload includes id with env unset", async () => {
    const canonical = getCanonicalSiteOrigin();
    const sRes = await postSurface(
      surfaceImpressionPostRequest({ surface: "acquisition" }, canonical),
    );
    expect(sRes.status).toBe(200);
    const { funnel_anon_id: minted } = (await sRes.json()) as {
      schema_version: number;
      funnel_anon_id: string;
    };

    const home = mkdtempSync(join(tmpdir(), "as-funnel-join-"));
    try {
      setSandboxHome(home);
      const { resetCliInstallIdModuleStateForTests } = await import(distResetInstall);
      resetCliInstallIdModuleStateForTests();
      const { runFunnelAnonSetFromArgvForTests } = await import(distRunFunnelAnon);
      expect(runFunnelAnonSetFromArgvForTests(["set", minted]).status).toBe("ok");

      delete process.env.AGENTSKEPTIC_FUNNEL_ANON_ID;

      const fetchBodies: unknown[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: unknown, init?: { body?: string }) => {
          if (init?.body) fetchBodies.push(JSON.parse(init.body));
          return { ok: true, status: 204 };
        }),
      );

      const { postProductActivationEvent } = await import(distPostProductActivation);
      const issued = new Date().toISOString();
      await postProductActivationEvent({
        phase: "verify_started",
        run_id: "run-join-e2e-1",
        issued_at: issued,
        workload_class: "non_bundled",
        workflow_lineage: "integrator_scoped",
        subcommand: "batch_verify",
        build_profile: "oss",
      });

      expect(fetchBodies.length).toBe(1);
      expect((fetchBodies[0] as { funnel_anon_id?: string }).funnel_anon_id).toBe(minted);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("negative: without funnel-anon set, activation omits funnel_anon_id when env unset", async () => {
    const home = mkdtempSync(join(tmpdir(), "as-funnel-join-neg-"));
    try {
      setSandboxHome(home);
      const { resetCliInstallIdModuleStateForTests } = await import(distResetInstall);
      resetCliInstallIdModuleStateForTests();
      delete process.env.AGENTSKEPTIC_FUNNEL_ANON_ID;

      const fetchBodies: unknown[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: unknown, init?: { body?: string }) => {
          if (init?.body) fetchBodies.push(JSON.parse(init.body));
          return { ok: true, status: 204 };
        }),
      );

      const { postProductActivationEvent } = await import(distPostProductActivation);
      const issued = new Date().toISOString();
      await postProductActivationEvent({
        phase: "verify_started",
        run_id: "run-join-neg-1",
        issued_at: issued,
        workload_class: "non_bundled",
        workflow_lineage: "integrator_scoped",
        subcommand: "batch_verify",
        build_profile: "oss",
      });

      expect(fetchBodies.length).toBe(1);
      expect((fetchBodies[0] as { funnel_anon_id?: string }).funnel_anon_id).toBeUndefined();
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
