import { NextRequest, NextResponse } from "next/server";
import {
  credentialMissingForDraftProvider,
  generateRegistryDraft,
  getBootstrapPackInputValidator,
  getRegistryDraftRequestValidator,
  getRegistryDraftResponseEnvelopeValidator,
  getToolsRegistryArrayValidator,
  parseAndNormalizeRegistryDraftRequest,
} from "agentskeptic/registryDraft";
import { db } from "@/db/client";
import { isFunnelSurfaceRequestOriginAllowed } from "@/lib/funnelRequestOriginAllowed";
import { extractClientIpKey } from "@/lib/magicLinkSendGate";
import { reserveRegistryDraftIpSlot, withSerializableRetry } from "@/lib/ossClaimRateLimits";

export const runtime = "nodejs";

const REGISTRY_DRAFT_MAX_BODY_BYTES = 65536;

function registryDraftFeatureActive(): boolean {
  return process.env.REGISTRY_DRAFT_ENABLED === "1";
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

  const cred = credentialMissingForDraftProvider(parsed.draftProvider, process.env);
  if (cred !== undefined) {
    return NextResponse.json({ code: "CONFIG_MISSING", message: cred }, { status: 503 });
  }

  const ipKey = extractClientIpKey(req);
  const rate = await withSerializableRetry(async () =>
    db.transaction(async (tx) => reserveRegistryDraftIpSlot(tx, ipKey)),
  );
  if (!rate.ok) {
    return new NextResponse(null, { status: 429 });
  }

  const validateResponse = getRegistryDraftResponseEnvelopeValidator();
  const validateTools = getToolsRegistryArrayValidator();

  const out = await generateRegistryDraft({
    parsed,
    validateResponseEnvelope: validateResponse,
    validateToolsRegistryArray: validateTools,
    env: process.env,
  });

  if (!out.ok) {
    return NextResponse.json(out.body, { status: out.status });
  }

  return NextResponse.json(out.body, { status: out.status });
}
