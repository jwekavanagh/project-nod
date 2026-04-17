# Telemetry daily pack (operator observability) — SSOT

This document is the **normative SSOT** for the **read-only telemetry daily pack** export: **CSV schemas**, **aggregate definitions**, **UTC windows**, **stdout JSON verdict**, **CLI**, and **operator scheduling**. It does **not** redefine funnel HTTP ingestion semantics—those remain in [`funnel-observability-ssot.md`](funnel-observability-ssot.md) and rolling KPI SQL in [`growth-metrics-ssot.md`](growth-metrics-ssot.md).

**Integrator:** N/A (operator-only tooling).

---

## Engineer

### Artifacts

- **Driver:** [`scripts/export-telemetry-daily-pack.mjs`](../scripts/export-telemetry-daily-pack.mjs)
- **SQL strings (single import surface):** [`scripts/lib/telemetry-daily-pack-sql.mjs`](../scripts/lib/telemetry-daily-pack-sql.mjs)
- **Mechanical SQL contract tests:** [`website/__tests__/telemetry-daily-pack-sql-contract.test.ts`](../website/__tests__/telemetry-daily-pack-sql-contract.test.ts)
- **Export integration proof:** [`website/__tests__/telemetry-daily-pack-export.integration.test.ts`](../website/__tests__/telemetry-daily-pack-export.integration.test.ts)

### CLI

```bash
npm run export:telemetry-daily-pack -- --day YYYY-MM-DD [--out-root <path>]
```

- **`--day`:** Required. **UTC calendar date** `YYYY-MM-DD` used for all day-bounded aggregates.
- **`--out-root`:** Optional. Defaults to **`<repo>/artifacts/telemetry-packs/`** (gitignored). Pack directory is **`<out-root>/<day>/`**.
- **Env:** **`TELEMETRY_DATABASE_URL`** required (telemetry Postgres; see [`telemetry-storage-ssot.md`](telemetry-storage-ssot.md)).

### Verdict JSON (stdout only)

On **every** run, **`stdout` is exactly one line**: a JSON object. **`stderr`** may contain diagnostics; it must **not** contain the verdict JSON.

Required keys: `schemaVersion` (1), `telemetryDailyPack` (true), `status` (`ok` | `error`), `code` (null or `MISSING_TELEMETRY_DATABASE_URL` | `BAD_DAY` | `DB_ERROR` | `IO_ERROR`), `day`, `outRoot`, `packDir`, `files` (basenames, fixed order on success), `message` (empty on success).

Exit codes: **0** iff `status === "ok"`; **2** for missing env / bad day; **1** for DB/IO errors.

### UTC windows

- **Daily window** for `--day = D`:** `created_at >= D::timestamp AT TIME ZONE 'UTC'`** and **`created_at < (D + 1 day) at 00:00 UTC`** (half-open).
- **Rolling 30-day window ending inclusive `D`:** **`created_at >= (D 00:00 UTC − 29 days)`** and **`created_at < (D + 1 day) at 00:00 UTC`**.

Daily aggregates are **not** the same queries as rolling-7d cross-surface KPIs in [`growth-metrics-ssot.md`](growth-metrics-ssot.md); do not read them as interchangeable.

### CSV files (headers and semantics)

Headers and column order are **exactly** the `CSV_HEADERS` strings in [`scripts/lib/telemetry-daily-pack-sql.mjs`](../scripts/lib/telemetry-daily-pack-sql.mjs). Row cardinality and metric definitions match the **Design** section of the approved implementation plan (frozen in repo history).

### Test bridge: `created_at` vs HTTP bodies

Export filters use **`funnel_event.created_at`** (insert-time default in [`website/src/db/telemetrySchema.ts`](../website/src/db/telemetrySchema.ts)).

HTTP activation stores **`issued_at` in `metadata` only** and enforces **±300s skew vs server `Date.now()`** ([`product-activation/route.ts`](../website/src/app/api/funnel/product-activation/route.ts), [`funnelProductActivationConstants.ts`](../website/src/lib/funnelProductActivationConstants.ts)). Therefore **frozen historical dates cannot be seeded deterministically via HTTP alone** for export proofs.

The **export integration test** inserts `telemetryFunnelEvents` via Drizzle with **explicit `createdAt`** and **production-shaped `metadata` JSON**, matching the pattern in [`website/__tests__/growth-cross-surface.integration.test.ts`](../website/__tests__/growth-cross-surface.integration.test.ts). Route ingestion remains covered by existing funnel tests; the export test proves **export SQL + CSV contracts**.

### SQL hygiene (enforced)

Pack SQL must not **project** raw `metadata` or `attribution` columns into CSVs. The Vitest contract strips allowed `metadata->>'…'` accessors and asserts no bare `metadata` token remains; it also asserts **`attribution` never appears** in pack SQL strings.

---

## Operator

### Daily cron (normative)

Run **once per UTC day** after `00:00 UTC`, exporting the **previous UTC calendar day**:

```bash
PREVIOUS_DAY=$(date -u -d yesterday +%F)   # GNU date; use your platform’s equivalent
npm run export:telemetry-daily-pack -- --day "$PREVIOUS_DAY"
```

The script **never** infers “yesterday” internally—the scheduler **must** pass `--day`.

### Retention (operator-owned)

Remove old packs with a bounded find (example; adjust paths and retention):

```bash
find artifacts/telemetry-packs -maxdepth 1 -type d -mtime +30 -print
```

Deletion automation is **out of scope** for the export tool itself.

---

## Related

- Funnel HTTP and beacon semantics: [`funnel-observability-ssot.md`](funnel-observability-ssot.md)
- Telemetry vs core DB split: [`telemetry-storage-ssot.md`](telemetry-storage-ssot.md)
- Rolling KPI SQL (distinct from daily pack): [`growth-metrics-ssot.md`](growth-metrics-ssot.md)
