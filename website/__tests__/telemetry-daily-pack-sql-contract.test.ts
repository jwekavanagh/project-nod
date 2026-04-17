import { describe, expect, it } from "vitest";
import {
  CSV_HEADERS,
  telemetryDailyPackSqlFragments,
} from "../../scripts/lib/telemetry-daily-pack-sql.mjs";

function stripAllowedMetadataAccess(sql: string): string {
  let s = sql;
  let prev = "";
  const re = /(?:\b\w+\.)?metadata->>'[^']*'/g;
  while (s !== prev) {
    prev = s;
    s = s.replace(re, "");
  }
  return s;
}

describe("telemetry daily pack SQL contract", () => {
  it("CSV_HEADERS match normative Design strings", () => {
    expect(CSV_HEADERS.daily_funnel_counts).toBe("day_utc,event,row_count");
    expect(CSV_HEADERS.daily_verify_workload).toBe("day_utc,event,workload_bucket,row_count");
    expect(CSV_HEADERS.daily_join_quality).toBe("day_utc,event,rows_with_fid,rows_without_fid");
    expect(CSV_HEADERS.daily_integrate_attributed_non_bundled).toBe(
      "day_utc,integrate_distinct_fid_count,global_non_bundled_outcome_row_count,global_non_bundled_outcome_distinct_fid_count,integrate_attributed_non_bundled_outcome_distinct_fid_count",
    );
    expect(CSV_HEADERS.rolling_30d_summary).toBe(
      "window_end_day_utc,window_start_day_utc,integrate_distinct_fid_count,global_non_bundled_outcome_row_count,global_non_bundled_outcome_distinct_fid_count,integrate_attributed_non_bundled_outcome_distinct_fid_count",
    );
  });

  it("SQL fragments never project raw metadata or mention attribution", () => {
    for (const { sql } of telemetryDailyPackSqlFragments()) {
      expect(sql.toLowerCase().includes("attribution")).toBe(false);
      const stripped = stripAllowedMetadataAccess(sql);
      expect(/\bmetadata\b/i.test(stripped)).toBe(false);
    }
  });
});
