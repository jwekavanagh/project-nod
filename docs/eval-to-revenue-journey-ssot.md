# Eval-to-revenue journey — SSOT (release-ready vs solved-in-production)

Normative completion contract for the **OSS eval-to-account** bridge and downstream commercial spine. **RR** (release-ready) gates prove plumbing in CI; **SP** (solved-in-production) gates are weekly production SQL on real traffic.

Detailed HTTP tables for claim routes remain in [`docs/oss-account-claim-ssot.md`](oss-account-claim-ssot.md) (do not duplicate full HTTP semantics here).

---

## Stage RR (merge bar)

| Gate ID | Instrument |
|---------|--------------|
| RR-A–RR-C | Vitest [`website/__tests__/oss-claim.integration.test.ts`](../website/__tests__/oss-claim.integration.test.ts) |
| RR-D | `npm run check:docs-claim-urls` |
| RR-E / RR-R3wiring / RR-R6 | Playwright [`e2e/oss-eval-to-account.spec.ts`](../e2e/oss-eval-to-account.spec.ts) (when `COMMERCIAL_OSS_EVAL_PLAYWRIGHT=1` with Mailpit + site) |
| RR-F | `npm run sql:eval-to-account-staging-gates -- --gate-set=rr` (mechanical funnel only; **excludes** SP-R3 / SP-R4a / SP-R4b) |

**Orchestrated command:** `npm run verify:eval-to-account-gate` in the website package.

---

## Stage SP (production)

Evaluated weekly on production `DATABASE_URL` with rolling **28 UTC-day** window for mint cohort **`D_ihm`**:

```sql
interactive_human_claim = true
AND telemetry_source IS DISTINCT FROM 'local_dev'
AND run_id NOT LIKE 'e2e:%'
AND created_at >= :window_start AND created_at < :window_end
```

Full gate table, **SP-R3 = 0.85** (canonical), **SP-R1b** two-branch `session` predicate, and **RR vs SP** split for SQL modes are specified in the program plan (v2 eval-to-account). **`npm run sql:eval-to-account-staging-gates -- --gate-set=sp`** runs SP-R0 … SP-R4b for operators.

---

## `Signed_measurable_definitions_v1` (required before first `SP_PASS` report)

Before the first weekly production **`SP_PASS`** evaluation, this document **must** contain a fenced markdown section **`Signed_measurable_definitions_v1`** with:

1. Verbatim prior product wording for “same session”.
2. Verbatim binding **`SP-R1b`** `EXISTS` SQL (both `OR` branches) matching [`website/__tests__/oss-claim.integration.test.ts`](../website/__tests__/oss-claim.integration.test.ts) / server implementation source — no paraphrase.
3. Product + Engineering sign-off row (names + date).

Until that fence exists in `main`, external **“solved”** claims and internal **`SP_PASS`** reporting are **out of scope**.

---

## Compatibility: legacy handoff URL

Steady-state `handoff_url` values use **`/verify/link?h=`** only. Old bookmarks may still use the legacy API path.

```Compatibility_308_only
If you have an old link containing `/api/oss/claim-handoff`, it **308 Permanent Redirect**s to **`/verify/link?h=…`** with the same opaque `h`. No secrets appear in the query string.
```
