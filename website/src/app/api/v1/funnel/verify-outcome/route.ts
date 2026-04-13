import { db } from "@/db/client";
import { apiKeys, usageReservations, users, verifyOutcomeBeacons } from "@/db/schema";
import { sha256HexApiKeyLookupFingerprint, verifyApiKey } from "@/lib/apiKeyCrypto";
import { buildLicensedVerifyOutcomeMetadata } from "@/lib/funnelCommercialMetadata";
import { VERIFY_OUTCOME_BEACON_MAX_RESERVATION_AGE_MS } from "@/lib/funnelVerifyOutcomeConstants";
import { verifyOutcomeRequestSchema } from "@/lib/funnelVerifyOutcome.contract";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new NextResponse(null, { status: 401 });
  }
  const rawKey = auth.slice(7).trim();

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = verifyOutcomeRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }

  const { run_id: runId, terminal_status, workload_class, subcommand } = parsed.data;

  const lookup = sha256HexApiKeyLookupFingerprint(rawKey);
  const keyRows = await db
    .select({
      key: apiKeys,
      user: users,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyLookupSha256, lookup), isNull(apiKeys.revokedAt)))
    .limit(1);

  const row = keyRows[0];
  if (!row) {
    return new NextResponse(null, { status: 401 });
  }

  if (!verifyApiKey(rawKey, row.key.keyHash)) {
    return new NextResponse(null, { status: 401 });
  }

  const resvRows = await db
    .select()
    .from(usageReservations)
    .where(
      and(eq(usageReservations.apiKeyId, row.key.id), eq(usageReservations.runId, runId)),
    )
    .limit(1);

  if (resvRows.length === 0) {
    return new NextResponse(null, { status: 404 });
  }

  const createdAt = resvRows[0]!.createdAt;
  const ageMs = Date.now() - createdAt.getTime();
  if (ageMs > VERIFY_OUTCOME_BEACON_MAX_RESERVATION_AGE_MS) {
    return new NextResponse(null, { status: 410 });
  }

  try {
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(verifyOutcomeBeacons)
        .values({
          apiKeyId: row.key.id,
          runId,
        })
        .onConflictDoNothing()
        .returning({ runId: verifyOutcomeBeacons.runId });

      if (inserted.length === 0) {
        return;
      }

      await logFunnelEvent(
        {
          event: "licensed_verify_outcome",
          userId: row.user.id,
          metadata: buildLicensedVerifyOutcomeMetadata({
            terminal_status,
            workload_class,
            subcommand,
          }),
        },
        tx,
      );
    });
  } catch (e) {
    console.error(e);
    return new NextResponse(null, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
