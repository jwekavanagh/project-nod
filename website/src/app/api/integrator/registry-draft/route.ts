import { NextRequest, NextResponse } from "next/server";
import {
  buildRegistryDraftPrompt,
  getBootstrapPackInputValidator,
  getRegistryDraftRequestValidator,
  getRegistryDraftResponseEnvelopeValidator,
  parseAndNormalizeRegistryDraftRequest,
} from "agentskeptic/registryDraft";
import { db } from "@/db/client";
import { isFunnelSurfaceRequestOriginAllowed } from "@/lib/funnelRequestOriginAllowed";
import { callOpenAiRegistryDraftJson } from "@/lib/registryDraft/callOpenAiRegistryDraft";
import { extractClientIpKey } from "@/lib/magicLinkSendGate";
import { reserveRegistryDraftIpSlot, withSerializableRetry } from "@/lib/ossClaimRateLimits";

export const runtime = "nodejs";

const REGISTRY_DRAFT_MAX_BODY_BYTES = 65536;

function registryDraftFeatureActive(): boolean {
  return process.env.REGISTRY_DRAFT_ENABLED === "1" && Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!registryDraftFeatureActive()) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isFunnelSurfaceRequestOriginAllowed(req)) {
    return NextResponse.json({ code: "FUNNEL_ORIGIN_FORBIDDEN" }, { status: 403 });
  }

  const rawCt = req.headers.get("content-type");
  const ct = rawCt?.toLowerCase() ?? "";
  if (!ct.startsWith("application/json")) {
    return new NextResponse(null, { status: 400 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const n = Number(contentLength);
    if (Number.isFinite(n) && n > REGISTRY_DRAFT_MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (Buffer.byteLength(rawText, "utf8") > REGISTRY_DRAFT_MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawText) as unknown;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const validateRequest = getRegistryDraftRequestValidator();
  const validateBootstrap = getBootstrapPackInputValidator();
  const parsed = parseAndNormalizeRegistryDraftRequest(jsonBody, validateRequest, validateBootstrap);
  if (!parsed.ok) {
    return NextResponse.json({ code: "INVALID_REQUEST", errors: parsed.errors }, { status: 400 });
  }

  const ipKey = extractClientIpKey(req);
  const rate = await withSerializableRetry(async () =>
    db.transaction(async (tx) => reserveRegistryDraftIpSlot(tx, ipKey)),
  );
  if (!rate.ok) {
    return new NextResponse(null, { status: 429 });
  }

  const prompt = buildRegistryDraftPrompt(parsed.normalizedBootstrapPackInput, parsed.ddlHint);
  const model = process.env.REGISTRY_DRAFT_MODEL?.trim() || "gpt-4o-mini";

  const ai = await callOpenAiRegistryDraftJson({ prompt, model });
  if (!ai.ok) {
    return NextResponse.json({ code: "OPENAI_ERROR", message: ai.message }, { status: ai.status });
  }

  let responseJson: unknown;
  try {
    responseJson = JSON.parse(ai.contentText) as unknown;
  } catch {
    return NextResponse.json({ code: "MODEL_OUTPUT_INVALID", message: "model returned non-JSON" }, { status: 502 });
  }

  const validateResponse = getRegistryDraftResponseEnvelopeValidator();
  if (!validateResponse(responseJson)) {
    return NextResponse.json(
      { code: "MODEL_OUTPUT_INVALID", errors: validateResponse.errors ?? [] },
      { status: 502 },
    );
  }

  return NextResponse.json(responseJson, { status: 200 });
}
