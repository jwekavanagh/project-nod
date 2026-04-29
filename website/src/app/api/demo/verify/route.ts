import {
  DEMO_ERROR_CODES,
  demoVerifyRequestSchema,
} from "@/lib/demoVerify.contract";
import {
  BundledVerifyEngineFailedError,
  BundledVerifyResultSchemaMismatchError,
  runBundledContractVerify,
} from "@/lib/bundledContractVerify";
import { logFunnelEvent } from "@/lib/funnelEvent";
import { DemoFixturesMissingError } from "@/lib/resolveRepoExamples";
import { telemetryCoreWriteFreezeActive } from "@/lib/telemetryWritesConfig";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function requestIdFrom(req: NextRequest): string {
  return req.headers.get("x-vercel-id") ?? randomUUID();
}

function jsonWithId(
  req: NextRequest,
  data: unknown,
  status: number,
): NextResponse {
  const id = requestIdFrom(req);
  return NextResponse.json(data, { status, headers: { "x-request-id": id } });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.METHOD_NOT_ALLOWED }, 405);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (telemetryCoreWriteFreezeActive()) {
    return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.UNAVAILABLE }, 503);
  }

  const rawCt = req.headers.get("content-type");
  const ct = rawCt?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE }, 415);
  }

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.INVALID_JSON }, 400);
  }

  const parsed = demoVerifyRequestSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.VALIDATION_FAILED }, 400);
  }

  try {
    const out = await runBundledContractVerify({
      kind: "scenarioFile",
      workflowId: parsed.data.scenarioId,
    });
    await logFunnelEvent({ event: "demo_verify_ok" });
    return jsonWithId(req, {
      ok: true as const,
      workflowId: out.workflowId,
      certificate: out.certificate,
      humanReport: out.humanReport,
    }, 200);
  } catch (e) {
    if (e instanceof DemoFixturesMissingError) {
      return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.FIXTURES_MISSING }, 503);
    }
    if (e instanceof BundledVerifyEngineFailedError) {
      return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.ENGINE_FAILED }, 500);
    }
    if (e instanceof BundledVerifyResultSchemaMismatchError) {
      return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.RESULT_SCHEMA_MISMATCH }, 500);
    }
    console.error("[api/demo/verify] unexpected error", e);
    return jsonWithId(req, { ok: false, error: DEMO_ERROR_CODES.ENGINE_FAILED }, 500);
  }
}
