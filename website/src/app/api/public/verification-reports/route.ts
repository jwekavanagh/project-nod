import { getCanonicalSiteOrigin } from "@/lib/canonicalSiteOrigin";
import {
  ACTIVATION_PROBLEM_BASE,
  activationJson,
  activationProblem,
} from "@/lib/activationHttp";
import {
  assertBodySizeWithinLimit,
  insertPublicVerificationReport,
  parseAndValidateEnvelope,
} from "@/lib/publicVerificationReportService";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function publicReportsEnabled(): boolean {
  return process.env.PUBLIC_VERIFICATION_REPORTS_ENABLED === "1";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!publicReportsEnabled()) {
    return activationProblem(req, {
      status: 503,
      type: `${ACTIVATION_PROBLEM_BASE}/service-unavailable`,
      title: "Service unavailable",
      detail: "Public verification report ingestion is disabled in this deployment.",
      code: "INGESTION_DISABLED",
    });
  }
  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Could not read request body.",
      code: "INVALID_BODY",
    });
  }
  try {
    assertBodySizeWithinLimit(rawText);
  } catch (e) {
    if ((e as Error & { status?: number }).status === 413) {
      return activationProblem(req, {
        status: 413,
        type: `${ACTIVATION_PROBLEM_BASE}/payload-too-large`,
        title: "Payload too large",
        detail: "Request body exceeds the maximum allowed size.",
        code: "PAYLOAD_TOO_LARGE",
      });
    }
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText) as unknown;
  } catch {
    return activationProblem(req, {
      status: 400,
      type: `${ACTIVATION_PROBLEM_BASE}/bad-request`,
      title: "Bad request",
      detail: "Invalid JSON.",
      code: "INVALID_JSON",
    });
  }
  try {
    const envelope = parseAndValidateEnvelope(parsed);
    const { id } = await insertPublicVerificationReport(envelope);
    const origin = getCanonicalSiteOrigin();
    const url = `${origin.replace(/\/$/, "")}/r/${id}`;
    const kind =
      "schemaVersion" in envelope && envelope.schemaVersion === 2 ? "outcome_certificate_v2" : envelope.kind;
    await logFunnelEvent({ event: "report_share_created", metadata: { id, kind } });
    return activationJson(req, { schemaVersion: 2, id, url }, 201);
  } catch (e) {
    const status = (e as Error & { status?: number }).status;
    if (status === 400) {
      return activationProblem(req, {
        status: 400,
        type: `${ACTIVATION_PROBLEM_BASE}/validation-failed`,
        title: "Validation failed",
        detail: "Envelope failed schema validation.",
        code: "VALIDATION_FAILED",
      });
    }
    console.error(e);
    return activationProblem(req, {
      status: 500,
      type: `${ACTIVATION_PROBLEM_BASE}/server-error`,
      title: "Server error",
      detail: "Could not store verification report.",
      code: "SERVER_ERROR",
    });
  }
}
