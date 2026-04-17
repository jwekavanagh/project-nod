import { dbTelemetry } from "@/db/telemetryClient";
import { telemetryFunnelEvents } from "@/db/telemetrySchema";
import { truncateCommercialFixtureDbs } from "./helpers/truncateCommercialFixture";
import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
const hasTelemetryUrl = Boolean(process.env.TELEMETRY_DATABASE_URL?.trim());

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const DAY = "2030-06-15";
const TS_IN = new Date("2030-06-15T12:00:00.000Z");
const TS_OUT = new Date("2030-05-15T12:00:00.000Z");
const FID_ACQ = "b5c0ee2f-4f1a-4c1a-8a1a-111111111111";
const FID_INT = "c5c0ee2f-4f1a-4c1a-8a1a-222222222222";

const telemetryRowDefaults = {
  serverVercelEnv: "unset" as const,
  serverNodeEnv: "test" as const,
};

const expectedDailyFunnel = `day_utc,event,row_count
2030-06-15,acquisition_landed,1
2030-06-15,integrate_landed,1
2030-06-15,verify_started,2
2030-06-15,verify_outcome,3
`;

const expectedDailyVerifyWorkload = `day_utc,event,workload_bucket,row_count
2030-06-15,verify_started,bundled_examples,1
2030-06-15,verify_started,non_bundled,1
2030-06-15,verify_started,__other__,0
2030-06-15,verify_outcome,bundled_examples,1
2030-06-15,verify_outcome,non_bundled,2
2030-06-15,verify_outcome,__other__,0
`;

const expectedDailyJoinQuality = `day_utc,event,rows_with_fid,rows_without_fid
2030-06-15,verify_started,1,1
2030-06-15,verify_outcome,3,0
`;

const expectedDailyIntegrate = `day_utc,integrate_distinct_fid_count,global_non_bundled_outcome_row_count,global_non_bundled_outcome_distinct_fid_count,integrate_attributed_non_bundled_outcome_distinct_fid_count
2030-06-15,1,1,1,1
`;

describe.skipIf(!hasDatabaseUrl || !hasTelemetryUrl)("telemetry daily pack export", () => {
  beforeEach(async () => {
    await truncateCommercialFixtureDbs();
  });

  it("writes five CSVs and stdout verdict for seeded telemetry rows", async () => {
    await dbTelemetry.insert(telemetryFunnelEvents).values([
      {
        event: "acquisition_landed",
        userId: null,
        metadata: {
          schema_version: 1,
          surface: "acquisition",
          funnel_anon_id: FID_ACQ,
          attribution: { landing_path: "/test" },
        },
        createdAt: TS_IN,
        ...telemetryRowDefaults,
      },
      {
        event: "integrate_landed",
        userId: null,
        metadata: {
          schema_version: 1,
          surface: "integrate",
          funnel_anon_id: FID_INT,
          attribution: {},
        },
        createdAt: TS_IN,
        ...telemetryRowDefaults,
      },
      {
        event: "verify_started",
        userId: null,
        metadata: {
          schema_version: 2,
          run_id: "run-seed-1",
          issued_at: "2030-06-15T12:00:00.000Z",
          workload_class: "bundled_examples",
          subcommand: "batch_verify",
          build_profile: "oss",
          telemetry_source: "unknown",
        },
        createdAt: TS_IN,
        ...telemetryRowDefaults,
      },
      {
        event: "verify_started",
        userId: null,
        metadata: {
          schema_version: 2,
          run_id: "run-seed-2",
          issued_at: "2030-06-15T12:00:00.000Z",
          workload_class: "non_bundled",
          subcommand: "batch_verify",
          build_profile: "oss",
          telemetry_source: "unknown",
          funnel_anon_id: FID_INT,
        },
        createdAt: TS_IN,
        ...telemetryRowDefaults,
      },
      {
        event: "verify_outcome",
        userId: null,
        metadata: {
          schema_version: 2,
          run_id: "run-seed-3",
          issued_at: "2030-06-15T12:00:00.000Z",
          workload_class: "non_bundled",
          subcommand: "batch_verify",
          build_profile: "oss",
          telemetry_source: "local_dev",
          terminal_status: "complete",
          funnel_anon_id: FID_INT,
        },
        createdAt: TS_IN,
        ...telemetryRowDefaults,
      },
      {
        event: "verify_outcome",
        userId: null,
        metadata: {
          schema_version: 2,
          run_id: "run-seed-4",
          issued_at: "2030-06-15T12:00:00.000Z",
          workload_class: "non_bundled",
          subcommand: "batch_verify",
          build_profile: "oss",
          telemetry_source: "unknown",
          terminal_status: "complete",
          funnel_anon_id: FID_INT,
        },
        createdAt: TS_IN,
        ...telemetryRowDefaults,
      },
      {
        event: "verify_outcome",
        userId: null,
        metadata: {
          schema_version: 2,
          run_id: "run-seed-5",
          issued_at: "2030-06-15T12:00:00.000Z",
          workload_class: "bundled_examples",
          subcommand: "batch_verify",
          build_profile: "oss",
          telemetry_source: "unknown",
          terminal_status: "complete",
          funnel_anon_id: FID_INT,
        },
        createdAt: TS_IN,
        ...telemetryRowDefaults,
      },
      {
        event: "verify_outcome",
        userId: null,
        metadata: {
          schema_version: 2,
          run_id: "run-seed-8",
          issued_at: "2030-05-15T12:00:00.000Z",
          workload_class: "non_bundled",
          subcommand: "batch_verify",
          build_profile: "oss",
          telemetry_source: "unknown",
          terminal_status: "complete",
          funnel_anon_id: FID_INT,
        },
        createdAt: TS_OUT,
        ...telemetryRowDefaults,
      },
    ]);

    const outRoot = mkdtempSync(join(tmpdir(), "telemetry-pack-"));
    try {
      const script = join(repoRoot, "scripts", "export-telemetry-daily-pack.mjs");
      const r = spawnSync(process.execPath, [script, "--day", DAY, "--out-root", outRoot], {
        encoding: "utf8",
        env: { ...process.env, TELEMETRY_DATABASE_URL: process.env.TELEMETRY_DATABASE_URL },
        cwd: repoRoot,
      });
      expect(r.error, r.error?.message).toBeUndefined();
      expect(r.status, `${r.stderr}\n${r.stdout}`).toBe(0);

      const verdict = JSON.parse(r.stdout.trim());
      expect(verdict.telemetryDailyPack).toBe(true);
      expect(verdict.status).toBe("ok");
      expect(verdict.code).toBeNull();
      expect(verdict.day).toBe(DAY);

      const packDir = join(outRoot, DAY);
      expect(existsSync(join(packDir, "daily_funnel_counts.csv"))).toBe(true);

      expect(readFileSync(join(packDir, "daily_funnel_counts.csv"), "utf8")).toBe(expectedDailyFunnel);
      expect(readFileSync(join(packDir, "daily_verify_workload.csv"), "utf8")).toBe(
        expectedDailyVerifyWorkload,
      );
      expect(readFileSync(join(packDir, "daily_join_quality.csv"), "utf8")).toBe(expectedDailyJoinQuality);
      expect(readFileSync(join(packDir, "daily_integrate_attributed_non_bundled.csv"), "utf8")).toBe(
        expectedDailyIntegrate,
      );

      const rolling = readFileSync(join(packDir, "rolling_30d_summary.csv"), "utf8");
      const rollingLines = rolling.trim().split("\n");
      expect(rollingLines[0]).toBe(
        "window_end_day_utc,window_start_day_utc,integrate_distinct_fid_count,global_non_bundled_outcome_row_count,global_non_bundled_outcome_distinct_fid_count,integrate_attributed_non_bundled_outcome_distinct_fid_count",
      );
      const data = rollingLines[1]!.split(",");
      expect(data[0]).toBe(DAY);
      expect(data[1]).toBe("2030-05-17");
      expect(data[2]).toBe("1");
      expect(data[3]).toBe("1");
      expect(data[4]).toBe("1");
      expect(data[5]).toBe("1");
    } finally {
      rmSync(outRoot, { recursive: true, force: true });
    }
  });

  it("stdout verdict on missing TELEMETRY_DATABASE_URL", () => {
    const script = join(repoRoot, "scripts", "export-telemetry-daily-pack.mjs");
    const env = { ...process.env };
    delete env.TELEMETRY_DATABASE_URL;
    const r = spawnSync(process.execPath, [script, "--day", DAY], {
      encoding: "utf8",
      env,
      cwd: repoRoot,
    });
    expect(r.status).toBe(2);
    const verdict = JSON.parse(r.stdout.trim());
    expect(verdict.status).toBe("error");
    expect(verdict.code).toBe("MISSING_TELEMETRY_DATABASE_URL");
  });
});
