import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { apiKeysV2 } from "@/db/schema";
import { isMissingApiKeyV2Relation } from "@/lib/isMissingApiKeyV2Relation";

/**
 * Loads API keys for `/account`. If `api_key_v2` is missing (migration not applied), returns `[]`
 * so the page renders; callers should run Drizzle migrations in production.
 */
export async function loadApiKeysV2RowsForAccount(userId: string) {
  try {
    return await db.select().from(apiKeysV2).where(eq(apiKeysV2.userId, userId));
  } catch (error) {
    if (!isMissingApiKeyV2Relation(error)) throw error;
    console.error(
      JSON.stringify({
        kind: "api_key_v2_relation_missing",
        surface: "account",
        hint: "Apply website Drizzle migrations (e.g. 0016_api_key_v2.sql)",
      }),
    );
    return [];
  }
}
