# Funnel observability — single source of truth

This document is the **SSOT** for **North Star funnel metrics**: measurable progression from canonical acquisition → integrate → **licensed verification completion** on the user’s workload. It does **not** change verification semantics, entitlements, or OpenAPI integrator contracts.

**Not duplicated here:** Stripe billing and `POST /api/v1/usage/reserve` behavior remain in [`commercial-ssot.md`](commercial-ssot.md). Integrator first-run steps remain in [`first-run-integration.md`](first-run-integration.md).

---

## Audiences

### Engineer

| Surface | Method | Path | Response |
|---------|--------|------|----------|
| Anonymous page beacon | `POST` | `/api/funnel/surface-impression` | `204` success; `400` bad JSON/body; `403` failed origin guard |
| Licensed completion beacon | `POST` | `/api/v1/funnel/verify-outcome` | See [HTTP table](#post-apiv1funnelverify-outcome-http-semantics) |

**`POST /api/funnel/surface-impression`**

- **Body:** `{ "surface": "acquisition" | "integrate" }` (JSON).
- **Origin guard:** `Origin` or `Referer` must parse to the **same origin** as `getCanonicalSiteOrigin()` in the website server (see [`website/src/lib/canonicalSiteOrigin.ts`](../website/src/lib/canonicalSiteOrigin.ts)).
- **Persistence:** `funnel_event.event` is `acquisition_landed` or `integrate_landed`; `user_id` is null; `metadata` is `{ "schema_version": 1, "surface": "<same as body>" }`.

**`POST /api/v1/funnel/verify-outcome`**

- **Not in** [`schemas/openapi-commercial-v1.yaml`](../schemas/openapi-commercial-v1.yaml) — operator-only; integrators should not depend on it.
- **Auth:** `Authorization: Bearer <api_key>` (same key material as license preflight).
- **Body:** `{ "run_id": string, "terminal_status": "complete"|"inconsistent"|"incomplete", "workload_class": "bundled_examples"|"non_bundled", "subcommand": "batch_verify"|"quick_verify" }`.
- **Gates:** `run_id` must exist in `usage_reservation` for the resolved API key; reservation `created_at` must be **no older than 6 hours** (wall clock, server time).
- **Idempotency:** table `verify_outcome_beacon` primary key `(api_key_id, run_id)`. First successful request inserts the beacon row and **one** `licensed_verify_outcome` funnel row. Duplicates return **`204`** with **no** additional funnel rows.

#### `POST /api/v1/funnel/verify-outcome` HTTP semantics

| Condition | Status | `funnel_event` (`licensed_verify_outcome`) |
|-----------|--------|---------------------------------------------|
| Missing/invalid JSON or body fails validation | `400` | No |
| Missing/invalid Bearer or API key not verified | `401` | No |
| `run_id` not reserved for this key | `404` | No |
| Reservation older than **6 hours** | **`410`** | No |
| First success | **`204`** | Yes, exactly once |
| Duplicate `(api_key_id, run_id)` | **`204`** | No additional row |

**Constant:** `VERIFY_OUTCOME_BEACON_MAX_RESERVATION_AGE_MS = 6 * 60 * 60 * 1000` in [`website/src/lib/funnelVerifyOutcomeConstants.ts`](../website/src/lib/funnelVerifyOutcomeConstants.ts).

**Funnel metadata** for `licensed_verify_outcome`: `{ "schema_version": 1, "terminal_status", "workload_class", "subcommand" }` (validated in [`website/src/lib/funnelCommercialMetadata.ts`](../website/src/lib/funnelCommercialMetadata.ts)).

### Integrator

This funnel surface is **telemetry only**. It does **not** affect whether verification is correct, whether `reserve` succeeds, or CLI exit codes. Failures on the beacon path are ignored by the CLI (best-effort).

### Operator

**Why not Vercel-only page views:** Page views do not correlate `run_id` to a completed licensed run. This design stores **queryable rows** in Postgres.

**Why not `reserve_allowed` as completion:** `reserve` is **preflight** before the engine runs; completion requires a terminal workflow / quick rollup outcome.

**Why `terminal_status` includes `inconsistent`:** The engine still evaluated the workload; that is activation signal distinct from “reserve only.”

**Why 6 hours:** Single fixed window between reserve and completion beacon without per-deployment tunables.

**Why `410` on expiry:** Distinguishes unknown `run_id` (`404`) from a reservation that **existed** but is too old (`410`).

**Why duplicate `204`:** Idempotent retries must not double-count activation.

**Operational definition of `workload_class`:** The CLI classifies paths against a **fixed allowlist** of shipped example files (see [`src/commercial/verifyWorkloadClassify.ts`](../src/commercial/verifyWorkloadClassify.ts)). `non_bundled` is the default when Postgres is used, stdin (`-`) is used for quick input, or any path is outside that allowlist. This is **not** cryptographic proof of customer data—only a deterministic split from bundled demos.

**Quick rollup → `terminal_status`:** [`src/commercial/quickVerifyFunnelTerminalStatus.ts`](../src/commercial/quickVerifyFunnelTerminalStatus.ts): `pass` → `complete`, `fail` → `inconsistent`, `uncertain` → `incomplete`.

#### Example SQL (weekly counts)

Replace date window as needed (`created_at` is timestamptz on `funnel_event`).

```sql
-- (1) Acquisition impressions
SELECT count(*) AS acquisition_landed
FROM funnel_event
WHERE event = 'acquisition_landed'
  AND created_at >= now() - interval '7 days';

-- (2) Integrate impressions
SELECT count(*) AS integrate_landed
FROM funnel_event
WHERE event = 'integrate_landed'
  AND created_at >= now() - interval '7 days';

-- (3) Licensed verification completions (non-bundled workload in metadata)
SELECT count(*) AS licensed_non_bundled
FROM funnel_event
WHERE event = 'licensed_verify_outcome'
  AND created_at >= now() - interval '7 days'
  AND metadata->>'workload_class' = 'non_bundled';
```

**Privacy:** No file contents or connection strings are logged—only enums, `run_id` correlation via `usage_reservation`, and classified path buckets.

---

## Validation (release gate)

From the repository root, **`npm run validate-commercial`** must pass (includes website Vitest with DB migrations applied). That is the binary gate for this SSOT’s implementation staying green.
