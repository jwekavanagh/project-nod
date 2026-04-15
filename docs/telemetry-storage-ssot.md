# Telemetry storage — single source of truth

Audience: **engineer**, **operator**.

## Purpose

Isolate **telemetry-tier** funnel traffic (anonymous acquisition/surface impressions, `demo_verify_ok`, CLI activation `verify_started` / `verify_outcome`, and activation beacons) on a dedicated Postgres **`TELEMETRY_DATABASE_URL`**. The core commercial database (`DATABASE_URL`) keeps **core-tier** `funnel_event` rows and all other business tables.

Cross-links:

- Core production boundary: [`docs/core-database-boundary-ssot.md`](core-database-boundary-ssot.md)
- Funnel HTTP semantics: [`docs/funnel-observability-ssot.md`](funnel-observability-ssot.md)
- Growth KPI SQL (telemetry DB for telemetry-tier metrics): [`docs/growth-metrics-ssot.md`](growth-metrics-ssot.md)

## Environment variables

| Variable | Role |
|----------|------|
| `TELEMETRY_DATABASE_URL` | Connection string for telemetry Postgres. **Required** when `VERCEL_ENV=production` (enforced in [`website/instrumentation.ts`](../website/instrumentation.ts)). |
| `AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB` | When `1`, telemetry-tier funnel rows from `logFunnelEvent` (except product-activation, which always writes funnel rows to the telemetry DB when `TELEMETRY_DATABASE_URL` is set) follow the split documented in [`website/src/lib/funnelEvent.ts`](../website/src/lib/funnelEvent.ts). Product-activation beacons always use the telemetry DB. |
| `AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE` | When `1`, `POST /api/funnel/product-activation`, `POST /api/funnel/surface-impression`, and `POST /api/demo/verify` return **503** without opening telemetry-tier DB transactions on core (see [`website/src/lib/telemetryWritesConfig.ts`](../website/src/lib/telemetryWritesConfig.ts)). |

## Cutover order (normative)

| Step | Action |
|------|--------|
| 1 | Apply core + telemetry migrations; deploy code with freeze support. |
| 2 | Set `AGENTSKEPTIC_TELEMETRY_CORE_WRITE_FREEZE=1` in production; confirm **503** on the three routes. |
| 3 | Run [`website/scripts/telemetry-backfill-core-to-telemetry.mjs`](../website/scripts/telemetry-backfill-core-to-telemetry.mjs) with both URLs set; script exits **0** only if telemetry DB was empty beforehand and counts match core. |
| 4 | Single deploy: unset freeze, set `AGENTSKEPTIC_TELEMETRY_WRITES_TELEMETRY_DB=1`, keep `TELEMETRY_DATABASE_URL` (see [`website/src/lib/funnelEvent.ts`](../website/src/lib/funnelEvent.ts)). |
| 5 | Growth reads already use `dbTelemetry` for telemetry-tier SQL (see `growthMetrics*.ts`). |
| 6 | After steady state, apply core cleanup migration **`0012_core_telemetry_cleanup`** (removes telemetry-tier rows and activation beacons from core; tightens `funnel_event` CHECK to core-tier events only). |

## Schema

- Telemetry tables are defined in [`website/src/db/telemetrySchema.ts`](../website/src/db/telemetrySchema.ts).
- Drizzle output: [`website/drizzle-telemetry/`](../website/drizzle-telemetry/).
- Migrations: `npm run db:migrate:telemetry` in the website package (uses [`website/scripts/db-migrate-telemetry.mjs`](../website/scripts/db-migrate-telemetry.mjs)).

## Sanctioned tooling

Telemetry schema changes use the same guarded `drizzle-kit` entry as core: `npm run db:generate:telemetry` (see [`docs/core-database-boundary-ssot.md`](core-database-boundary-ssot.md)).
