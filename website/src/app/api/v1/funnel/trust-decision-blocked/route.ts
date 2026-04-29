import { db } from "@/db/client";
import { trustDecisionReceipts } from "@/db/schema";
import {
  ACTIVATION_PROBLEM_BASE,
  activationNoContent,
  activationProblem,
  resolveActivationRequestId,
} from "@/lib/activationHttp";
import { authenticateApiKey, requireScopes } from "@/lib/apiKeyAuthGateway";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { trustDecisionRecordIngestSchema } from "@/lib/trustDecisionRecord.contract";
import { trustDecisionFingerprintHex } from "@/lib/trustDecisionFingerprint";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 131072;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rid = resolveActivationRequestId(req);
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return activationProblem(req, {
      status: 413,
      type: `${ACTIVATION_PROBLEM_BASE}/payload-too-large`,
      title: "Payload too large",
      detail: `Body exceeds ${MAX_BODY_BYTES} octets.`,
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(raw) as unknown;
  } catch {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Invalid JSON body.",
      code: "INVALID_JSON",
    });
  }

  const parsed = trustDecisionRecordIngestSchema.safeParse(jsonBody);
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

  const record = parsed.data;
  const fingerprint = trustDecisionFingerprintHex(record);

  try {
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(trustDecisionReceipts)
        .values({ apiKeyId, fingerprintSha256: fingerprint })
        .onConflictDoNothing()
        .returning({ apiKeyId: trustDecisionReceipts.apiKeyId });

      if (inserted.length === 0) {
        return;
      }

      await logFunnelEvent(
        {
          event: "trust_decision_blocked",
          userId,
          metadata: record,
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
      detail: "Could not record trust decision block.",
      code: "SERVER_ERROR",
    });
  }

  return activationNoContent(rid);
}
