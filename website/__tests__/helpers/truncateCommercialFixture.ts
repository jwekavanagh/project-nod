import { db } from "@/db/client";
import { dbTelemetry } from "@/db/telemetryClient";
import { isMissingApiKeyV2Relation } from "@/lib/isMissingApiKeyV2Relation";
import { sql } from "drizzle-orm";
import { assertPostgresUrlsSafeForTruncate } from "./assertDestructivePostgresUrlsForTests";

/** Core commercial tables when `api_key_v2` migration is not applied yet. */
const CORE_TRUNCATE_SQL_LEGACY = `
  TRUNCATE magic_link_send_counter, oss_claim_ticket, oss_claim_rate_limit_counter, verify_outcome_beacon, funnel_event, stripe_event, usage_reservation, usage_counter, api_key, session, account, "verificationToken", "user" RESTART IDENTITY CASCADE
`;

/** Core commercial tables including `api_key_v2` (avoids CASCADE NOTICE noise when present). */
const CORE_TRUNCATE_SQL_WITH_V2 = `
  TRUNCATE magic_link_send_counter, oss_claim_ticket, oss_claim_rate_limit_counter, verify_outcome_beacon, funnel_event, stripe_event, usage_reservation, usage_counter, api_key_v2, api_key, session, account, "verificationToken", "user" RESTART IDENTITY CASCADE
`;

const TELEMETRY_TRUNCATE_SQL = `
  TRUNCATE funnel_event, product_activation_started_beacon, product_activation_outcome_beacon RESTART IDENTITY CASCADE
`;

/**
 * Truncates shared commercial tables used by website integration tests.
 * Tries to include `api_key_v2` when the migration exists; otherwise falls back so older DBs keep working.
 */
export async function truncateCoreCommercialDb(contextLabel: string): Promise<void> {
  assertPostgresUrlsSafeForTruncate(contextLabel);
  try {
    await db.execute(sql.raw(CORE_TRUNCATE_SQL_WITH_V2));
  } catch (error) {
    if (!isMissingApiKeyV2Relation(error)) {
      throw error;
    }
    await db.execute(sql.raw(CORE_TRUNCATE_SQL_LEGACY));
  }
}

/** Clears commercial + telemetry fixture tables used by website integration tests. */
export async function truncateCommercialFixtureDbs(): Promise<void> {
  await truncateCoreCommercialDb("truncateCommercialFixtureDbs");
  if (process.env.TELEMETRY_DATABASE_URL?.trim()) {
    await dbTelemetry.execute(sql.raw(TELEMETRY_TRUNCATE_SQL));
  }
}
