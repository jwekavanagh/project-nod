import { db } from "@/db/client";
import { usageReservations, verifyOutcomeBeacons } from "@/db/schema";
import {
  ACTIVATION_PROBLEM_BASE,
  activationNoContent,
  activationProblem,
  resolveActivationRequestId,
} from "@/lib/activationHttp";
import { authenticateApiKey, requireScopes } from "@/lib/apiKeyAuthGateway";
import { buildLicensedVerifyOutcomeMetadata } from "@/lib/funnelCommercialMetadata";
import { VERIFY_OUTCOME_BEACON_MAX_RESERVATION_AGE_MS } from "@/lib/funnelVerifyOutcomeConstants";
import { verifyOutcomeRequestSchema } from "@/lib/funnelVerifyOutcome.contract";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rid = resolveActivationRequestId(req);
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

  const authn = await authenticateApiKey(req);
  if (!authn.ok) {
    return authn.response;
  }
  const scopeCheck = requireScopes(req, authn.principal, ["report"]);
  if (!scopeCheck.ok) {
    return scopeCheck.response;
  }
  const apiKeyId = authn.principal.keyId;
  const userId = authn.principal.userId;

  const {
    run_id: runId,
    workflow_id,
    trust_decision,
    reason_codes,
    terminal_status,
    workload_class,
    subcommand,
    activation,
    evidence_gap_primary,
  } = parsed.data;

  const resvRows = await db
    .select()
    .from(usageReservations)
    .where(
      and(eq(usageReservations.apiKeyId, apiKeyId), eq(usageReservations.runId, runId)),
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
          apiKeyId,
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
          userId,
          metadata: buildLicensedVerifyOutcomeMetadata(
            subcommand === "activate"
              ? {
                  terminal_status,
                  workload_class,
                  subcommand: "activate",
                  workflow_id,
                  trust_decision,
                  reason_codes,
                  evidence_gap_primary,
                  activation: activation!,
                }
              : {
                  terminal_status,
                  workload_class,
                  subcommand,
                  workflow_id,
                  trust_decision,
                  reason_codes,
                  evidence_gap_primary,
                },
          ),
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
