/**
 * Normative SELECT strings for telemetry daily pack export.
 * Consumed by scripts/export-telemetry-daily-pack.mjs and website/__tests__/telemetry-daily-pack-sql-contract.test.ts
 *
 * Parameters (every query): $1 = day_utc label (YYYY-MM-DD text), $2 = same calendar date for bounds (YYYY-MM-DD text, ::date)
 */

export const CSV_HEADERS = {
  daily_funnel_counts: "day_utc,event,row_count",
  daily_verify_workload: "day_utc,event,workload_bucket,row_count",
  daily_join_quality: "day_utc,event,rows_with_fid,rows_without_fid",
  daily_integrate_attributed_non_bundled:
    "day_utc,integrate_distinct_fid_count,global_non_bundled_outcome_row_count,global_non_bundled_outcome_distinct_fid_count,integrate_attributed_non_bundled_outcome_distinct_fid_count",
  rolling_30d_summary:
    "window_end_day_utc,window_start_day_utc,integrate_distinct_fid_count,global_non_bundled_outcome_row_count,global_non_bundled_outcome_distinct_fid_count,integrate_attributed_non_bundled_outcome_distinct_fid_count",
};

export const sqlDailyFunnelCounts = `
WITH b AS (
  SELECT ($2::date)::timestamp AT TIME ZONE 'UTC' AS ts_start,
         (($2::date)::timestamp AT TIME ZONE 'UTC' + interval '1 day') AS ts_end
)
SELECT $1::text AS day_utc,
       x.event::text,
       COALESCE(c.cnt, 0)::int AS row_count
FROM (
  VALUES ('acquisition_landed'::text),
        ('integrate_landed'),
        ('verify_started'),
        ('verify_outcome')
) AS x(event)
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = x.event
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
) c ON true
ORDER BY CASE x.event
  WHEN 'acquisition_landed' THEN 1
  WHEN 'integrate_landed' THEN 2
  WHEN 'verify_started' THEN 3
  ELSE 4
END`;

export const sqlDailyVerifyWorkload = `
WITH b AS (
  SELECT ($2::date)::timestamp AT TIME ZONE 'UTC' AS ts_start,
         (($2::date)::timestamp AT TIME ZONE 'UTC' + interval '1 day') AS ts_end
)
SELECT $1::text AS day_utc,
       e.event::text,
       e.workload_bucket::text,
       COALESCE(n.cnt, 0)::int AS row_count
FROM (
  VALUES ('verify_started'::text, 'bundled_examples'::text),
        ('verify_started', 'non_bundled'),
        ('verify_started', '__other__'),
        ('verify_outcome', 'bundled_examples'),
        ('verify_outcome', 'non_bundled'),
        ('verify_outcome', '__other__')
) AS e(event, workload_bucket)
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = e.event
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND (
      CASE
        WHEN f.metadata->>'workload_class' = 'bundled_examples' THEN 'bundled_examples'
        WHEN f.metadata->>'workload_class' = 'non_bundled' THEN 'non_bundled'
        ELSE '__other__'
      END
    ) = e.workload_bucket
) n ON true
ORDER BY CASE e.event WHEN 'verify_started' THEN 1 ELSE 2 END,
         CASE e.workload_bucket WHEN 'bundled_examples' THEN 1 WHEN 'non_bundled' THEN 2 ELSE 3 END`;

export const sqlDailyJoinQuality = `
WITH b AS (
  SELECT ($2::date)::timestamp AT TIME ZONE 'UTC' AS ts_start,
         (($2::date)::timestamp AT TIME ZONE 'UTC' + interval '1 day') AS ts_end
)
SELECT $1::text AS day_utc,
       x.event::text,
       COALESCE(w.cnt, 0)::int AS rows_with_fid,
       COALESCE(wo.cnt, 0)::int AS rows_without_fid
FROM (VALUES ('verify_started'::text), ('verify_outcome')) AS x(event)
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = x.event
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND f.metadata->>'funnel_anon_id' IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
) w ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS cnt
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = x.event
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND (f.metadata->>'funnel_anon_id' IS NULL OR TRIM(f.metadata->>'funnel_anon_id') = '')
) wo ON true
ORDER BY CASE x.event WHEN 'verify_started' THEN 1 ELSE 2 END`;

export const sqlDailyIntegrateAttributedNonBundled = `
WITH b AS (
  SELECT ($2::date)::timestamp AT TIME ZONE 'UTC' AS ts_start,
         (($2::date)::timestamp AT TIME ZONE 'UTC' + interval '1 day') AS ts_end
),
intg AS (
  SELECT COUNT(DISTINCT TRIM(f.metadata->>'funnel_anon_id'))::int AS integrate_distinct_fid_count
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'integrate_landed'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
glob_row AS (
  SELECT COUNT(*)::int AS global_non_bundled_outcome_row_count
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'verify_outcome'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND f.metadata->>'workload_class' = 'non_bundled'
    AND f.metadata->>'telemetry_source' IS DISTINCT FROM 'local_dev'
),
glob_dist AS (
  SELECT COUNT(DISTINCT TRIM(f.metadata->>'funnel_anon_id'))::int AS global_non_bundled_outcome_distinct_fid_count
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'verify_outcome'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND f.metadata->>'workload_class' = 'non_bundled'
    AND f.metadata->>'telemetry_source' IS DISTINCT FROM 'local_dev'
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
intg_fid AS (
  SELECT DISTINCT TRIM(f.metadata->>'funnel_anon_id') AS fid
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'integrate_landed'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
qual AS (
  SELECT DISTINCT TRIM(f.metadata->>'funnel_anon_id') AS fid
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'verify_outcome'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND f.metadata->>'workload_class' = 'non_bundled'
    AND f.metadata->>'telemetry_source' IS DISTINCT FROM 'local_dev'
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
attr AS (
  SELECT COUNT(DISTINCT i.fid)::int AS integrate_attributed_non_bundled_outcome_distinct_fid_count
  FROM intg_fid i
  INNER JOIN qual q ON i.fid = q.fid
)
SELECT $1::text AS day_utc,
       intg.integrate_distinct_fid_count,
       glob_row.global_non_bundled_outcome_row_count,
       glob_dist.global_non_bundled_outcome_distinct_fid_count,
       attr.integrate_attributed_non_bundled_outcome_distinct_fid_count
FROM intg
CROSS JOIN glob_row
CROSS JOIN glob_dist
CROSS JOIN attr`;

export const sqlRolling30dSummary = `
WITH b AS (
  SELECT (($2::date)::timestamp AT TIME ZONE 'UTC' - interval '29 days') AS ts_start,
         (($2::date)::timestamp AT TIME ZONE 'UTC' + interval '1 day') AS ts_end
),
intg AS (
  SELECT COUNT(DISTINCT TRIM(f.metadata->>'funnel_anon_id'))::int AS integrate_distinct_fid_count
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'integrate_landed'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
glob_row AS (
  SELECT COUNT(*)::int AS global_non_bundled_outcome_row_count
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'verify_outcome'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND f.metadata->>'workload_class' = 'non_bundled'
    AND f.metadata->>'telemetry_source' IS DISTINCT FROM 'local_dev'
),
glob_dist AS (
  SELECT COUNT(DISTINCT TRIM(f.metadata->>'funnel_anon_id'))::int AS global_non_bundled_outcome_distinct_fid_count
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'verify_outcome'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND f.metadata->>'workload_class' = 'non_bundled'
    AND f.metadata->>'telemetry_source' IS DISTINCT FROM 'local_dev'
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
intg_fid AS (
  SELECT DISTINCT TRIM(f.metadata->>'funnel_anon_id') AS fid
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'integrate_landed'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
qual AS (
  SELECT DISTINCT TRIM(f.metadata->>'funnel_anon_id') AS fid
  FROM funnel_event f
  CROSS JOIN b
  WHERE f.event = 'verify_outcome'
    AND f.created_at >= b.ts_start
    AND f.created_at < b.ts_end
    AND f.metadata->>'workload_class' = 'non_bundled'
    AND f.metadata->>'telemetry_source' IS DISTINCT FROM 'local_dev'
    AND TRIM(f.metadata->>'funnel_anon_id') IS NOT NULL
    AND TRIM(f.metadata->>'funnel_anon_id') <> ''
),
attr AS (
  SELECT COUNT(DISTINCT i.fid)::int AS integrate_attributed_non_bundled_outcome_distinct_fid_count
  FROM intg_fid i
  INNER JOIN qual q ON i.fid = q.fid
)
SELECT $1::text AS window_end_day_utc,
       ($2::date - 29)::text AS window_start_day_utc,
       intg.integrate_distinct_fid_count,
       glob_row.global_non_bundled_outcome_row_count,
       glob_dist.global_non_bundled_outcome_distinct_fid_count,
       attr.integrate_attributed_non_bundled_outcome_distinct_fid_count
FROM intg
CROSS JOIN glob_row
CROSS JOIN glob_dist
CROSS JOIN attr`;

/** @returns {{ id: string, sql: string }[]} */
export function telemetryDailyPackSqlFragments() {
  return [
    { id: "daily_funnel_counts", sql: sqlDailyFunnelCounts },
    { id: "daily_verify_workload", sql: sqlDailyVerifyWorkload },
    { id: "daily_join_quality", sql: sqlDailyJoinQuality },
    { id: "daily_integrate_attributed_non_bundled", sql: sqlDailyIntegrateAttributedNonBundled },
    { id: "rolling_30d_summary", sql: sqlRolling30dSummary },
  ];
}
