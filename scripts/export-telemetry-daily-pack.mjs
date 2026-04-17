#!/usr/bin/env node
/**
 * Telemetry daily pack: read-only SELECTs against TELEMETRY_DATABASE_URL funnel_event,
 * writes five CSVs under <out-root>/<day>/, prints single-line JSON verdict to stdout only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  CSV_HEADERS,
  sqlDailyFunnelCounts,
  sqlDailyIntegrateAttributedNonBundled,
  sqlDailyJoinQuality,
  sqlDailyVerifyWorkload,
  sqlRolling30dSummary,
} from "./lib/telemetry-daily-pack-sql.mjs";

function csvFromRowsWithHeader(headerLine, rows, columns) {
  const lines = [headerLine];
  for (const row of rows) {
    lines.push(columns.map((c) => String(row[c] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FILE_ORDER = [
  "daily_funnel_counts.csv",
  "daily_verify_workload.csv",
  "daily_join_quality.csv",
  "daily_integrate_attributed_non_bundled.csv",
  "rolling_30d_summary.csv",
];

function parseArgs(argv) {
  let day = null;
  let outRoot = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--day" && argv[i + 1]) {
      day = argv[++i];
    } else if (a === "--out-root" && argv[i + 1]) {
      outRoot = argv[++i];
    }
  }
  return { day, outRoot };
}

/** @returns {string|null} */
function parseDayUtc(s) {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function verdictOut(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function main() {
  const { day: dayRaw, outRoot: outRootRaw } = parseArgs(process.argv);
  const day = parseDayUtc(dayRaw ?? "");

  const baseFail = {
    schemaVersion: 1,
    telemetryDailyPack: true,
    status: "error",
    code: /** @type {const} */ ("BAD_DAY"),
    day: dayRaw?.trim() || null,
    outRoot: "",
    packDir: "",
    files: [],
    message: "",
  };

  if (!process.env.TELEMETRY_DATABASE_URL?.trim()) {
    verdictOut({
      ...baseFail,
      code: "MISSING_TELEMETRY_DATABASE_URL",
      message: "TELEMETRY_DATABASE_URL is required",
    });
    process.exitCode = 2;
    return;
  }

  if (!dayRaw || !day) {
    verdictOut({
      ...baseFail,
      code: "BAD_DAY",
      message: "Missing or invalid --day YYYY-MM-DD (UTC calendar date)",
    });
    process.exitCode = 2;
    return;
  }

  const outRootAbs = path.resolve(outRootRaw?.trim() || path.join(root, "artifacts", "telemetry-packs"));
  const packDirAbs = path.join(outRootAbs, day);

  const params = [day, day];
  const client = new pg.Client({ connectionString: process.env.TELEMETRY_DATABASE_URL.trim() });

  try {
    await client.connect();
  } catch (e) {
    verdictOut({
      ...baseFail,
      day,
      outRoot: outRootAbs,
      packDir: "",
      code: "DB_ERROR",
      message: e instanceof Error ? e.message : String(e),
    });
    process.exitCode = 1;
    return;
  }

  try {
    mkdirSync(packDirAbs, { recursive: true });

    const r1 = await client.query(sqlDailyFunnelCounts, params);
    writeFileSync(
      path.join(packDirAbs, "daily_funnel_counts.csv"),
      csvFromRowsWithHeader(CSV_HEADERS.daily_funnel_counts, r1.rows, ["day_utc", "event", "row_count"]),
      "utf8",
    );

    const r2 = await client.query(sqlDailyVerifyWorkload, params);
    writeFileSync(
      path.join(packDirAbs, "daily_verify_workload.csv"),
      csvFromRowsWithHeader(CSV_HEADERS.daily_verify_workload, r2.rows, [
        "day_utc",
        "event",
        "workload_bucket",
        "row_count",
      ]),
      "utf8",
    );

    const r3 = await client.query(sqlDailyJoinQuality, params);
    writeFileSync(
      path.join(packDirAbs, "daily_join_quality.csv"),
      csvFromRowsWithHeader(CSV_HEADERS.daily_join_quality, r3.rows, ["day_utc", "event", "rows_with_fid", "rows_without_fid"]),
      "utf8",
    );

    const r4 = await client.query(sqlDailyIntegrateAttributedNonBundled, params);
    writeFileSync(
      path.join(packDirAbs, "daily_integrate_attributed_non_bundled.csv"),
      csvFromRowsWithHeader(CSV_HEADERS.daily_integrate_attributed_non_bundled, r4.rows, [
        "day_utc",
        "integrate_distinct_fid_count",
        "global_non_bundled_outcome_row_count",
        "global_non_bundled_outcome_distinct_fid_count",
        "integrate_attributed_non_bundled_outcome_distinct_fid_count",
      ]),
      "utf8",
    );

    const r5 = await client.query(sqlRolling30dSummary, params);
    writeFileSync(
      path.join(packDirAbs, "rolling_30d_summary.csv"),
      csvFromRowsWithHeader(CSV_HEADERS.rolling_30d_summary, r5.rows, [
        "window_end_day_utc",
        "window_start_day_utc",
        "integrate_distinct_fid_count",
        "global_non_bundled_outcome_row_count",
        "global_non_bundled_outcome_distinct_fid_count",
        "integrate_attributed_non_bundled_outcome_distinct_fid_count",
      ]),
      "utf8",
    );

    verdictOut({
      schemaVersion: 1,
      telemetryDailyPack: true,
      status: "ok",
      code: null,
      day,
      outRoot: outRootAbs,
      packDir: packDirAbs,
      files: [...FILE_ORDER],
      message: "",
    });
    process.exitCode = 0;
  } catch (e) {
    const isIo =
      e &&
      typeof e === "object" &&
      "code" in e &&
      typeof e.code === "string" &&
      ["ENOENT", "EACCES", "EROFS", "ENOTDIR"].includes(e.code);
    verdictOut({
      ...baseFail,
      day,
      outRoot: outRootAbs,
      packDir: packDirAbs,
      code: isIo ? "IO_ERROR" : "DB_ERROR",
      message: e instanceof Error ? e.message : String(e),
    });
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
