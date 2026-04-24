import { db } from "@/db/client";
import { apiKeys, usageReservations, users, verifyOutcomeBeacons } from "@/db/schema";
import { sha256HexApiKeyLookupFingerprint, verifyApiKey } from "@/lib/apiKeyCrypto";
import {
  ACTIVATION_PROBLEM_BASE,
  activationNoContent,
  activationProblem,
  resolveActivationRequestId,
} from "@/lib/activationHttp";
import { buildLicensedVerifyOutcomeMetadata } from "@/lib/funnelCommercialMetadata";
import { VERIFY_OUTCOME_BEACON_MAX_RESERVATION_AGE_MS } from "@/lib/funnelVerifyOutcomeConstants";
import { verifyOutcomeRequestSchema } from "@/lib/funnelVerifyOutcome.contract";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rid = resolveActivationRequestId(req);
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return activationProblem(req, {
      status: 401,
      type: `${ACTIVATION_PROBLEM_BASE}/unauthorized`,
      title: "Unauthorized",
      detail: "Missing or invalid Authorization Bearer token.",
      code: "UNAUTHORIZED",
    });
  }
  const rawKey = auth.slice(7).trim();

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Invalid JSON body.",
      code: "INVALID_JSON",
    });
  }

  const parsed = verifyOutcomeRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Request body failed validation.",
      code: "VALIDATION_FAILED",
    });
  }

  const {
    run_id: runId,
    workflow_id,
    trust_decision,
    reason_codes,
    terminal_status,
    workload_class,
    subcommand,
  } = parsed.data;

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
    return activationProblem(req, {
      status: 401,
      type: `${ACTIVATION_PROBLEM_BASE}/unauthorized`,
      title: "Unauthorized",
      detail: "Unknown or revoked API key.",
      code: "INVALID_KEY",
    });
  }

  if (!verifyApiKey(rawKey, row.key.keyHash)) {
    return activationProblem(req, {
      status: 401,
      type: `${ACTIVATION_PROBLEM_BASE}/unauthorized`,
      title: "Unauthorized",
      detail: "Invalid API key.",
      code: "INVALID_KEY",
    });
  }

  const resvRows = await db
    .select()
    .from(usageReservations)
    .where(
      and(eq(usageReservations.apiKeyId, row.key.id), eq(usageReservations.runId, runId)),
    )
    .limit(1);

  if (resvRows.length === 0) {
    return activationProblem(req, {
      status: 404,
      type: `${ACTIVATION_PROBLEM_BASE}/not-found`,
      title: "Not found",
      detail: "No usage reservation matches this run_id for this API key.",
      code: "RESERVATION_NOT_FOUND",
    });
  }

  const createdAt = resvRows[0]!.createdAt;
  const ageMs = Date.now() - createdAt.getTime();
  if (ageMs > VERIFY_OUTCOME_BEACON_MAX_RESERVATION_AGE_MS) {
    return activationProblem(req, {
      status: 410,
      type: `${ACTIVATION_PROBLEM_BASE}/gone`,
      title: "Gone",
      detail: "Reservation is too old to accept a verify-outcome beacon.",
      code: "RESERVATION_EXPIRED",
    });
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
            workflow_id,
            trust_decision,
            reason_codes,
          }),
        },
        tx,
      );
    });
  } catch (e) {
    console.error(e);
    return activationProblem(req, {
      status: 503,
      type: `${ACTIVATION_PROBLEM_BASE}/server-error`,
      title: "Service unavailable",
      detail: "Could not record verify-outcome beacon.",
      code: "SERVER_ERROR",
    });
  }

  return activationNoContent(rid);
}
