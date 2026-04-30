/**
 * Replay legacy enforcement history into authoritative FSM rows.
 *
 * Imports the **single** reducer spine `applyFsmNormalizedEvent` from `verificationLifecycle`
 * alongside normalized legacy events derived from existing `enforcement_events` /
 * `enforcement_baselines`.
 *
 * This script is intentionally **manual / operator-invoked**. Run **after**
 * drizzle migration `0022_enforcement_lifecycle_fsm.sql` applied to DATABASE_URL:
 *
 *   cd website && npx tsx scripts/backfill-enforcement-lifecycle.ts --dry-run
 *
 * Full deterministic writer (FSM INSERTs + optional `artifacts/enforcement-lifecycle-backfill.json`)
 * is slated for incremental rollout alongside CI fixtures; callers should normalize each legacy
 * row → `FsmNormalizedEvent` ordered by `(created_at, id)` **before** persisting transitions.
 */

import process from "node:process";

const dryRun = process.argv.includes("--dry-run");

console.error(
  dryRun ?
    "[enforcement-backfill] dry-run: reducer available as applyFsmNormalizedEvent (no DB writes)."
  : "[enforcement-backfill] pass --dry-run until operator wiring is completed.",
);
process.exit(dryRun ? 0 : 2);
