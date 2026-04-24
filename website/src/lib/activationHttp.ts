import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Correlation / support ID on every activation HTTP response (PRD). */
export const ACTIVATION_REQUEST_ID_HEADER = "x-request-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9._-]{8,128}$/;

export const ACTIVATION_PROBLEM_BASE = "https://agentskeptic.com/problems";

export function isValidActivationRequestId(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = raw.trim();
  if (s.length === 0 || s.length > 128) return false;
  return UUID_RE.test(s) || TOKEN_RE.test(s);
}

/** Prefer a well-formed client `x-request-id`; otherwise mint a UUID. */
export function resolveActivationRequestId(req: NextRequest): string {
  const h = req.headers.get(ACTIVATION_REQUEST_ID_HEADER);
  if (isValidActivationRequestId(h)) return h!.trim();
  return randomUUID();
}

export function activationHeaders(requestId: string): Headers {
  const h = new Headers();
  h.set(ACTIVATION_REQUEST_ID_HEADER, requestId);
  return h;
}

export function mergeActivationHeaders(requestId: string, init?: HeadersInit): Headers {
  const out = new Headers(init);
  out.set(ACTIVATION_REQUEST_ID_HEADER, requestId);
  return out;
}

export type ActivationProblemInput = {
  status: number;
  type: string;
  title: string;
  detail: string;
  code?: string;
  instance?: string;
};

export function activationProblemBody(input: ActivationProblemInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: input.type,
    title: input.title,
    status: input.status,
    detail: input.detail,
  };
  if (input.code != null) body.code = input.code;
  if (input.instance != null) body.instance = input.instance;
  return body;
}

export function activationProblem(req: NextRequest, input: ActivationProblemInput): NextResponse {
  const id = resolveActivationRequestId(req);
  return NextResponse.json(activationProblemBody(input), {
    status: input.status,
    headers: mergeActivationHeaders(id),
  });
}

export function activationProblemWithId(
  requestId: string,
  input: ActivationProblemInput,
): NextResponse {
  return NextResponse.json(activationProblemBody(input), {
    status: input.status,
    headers: activationHeaders(requestId),
  });
}

export function activationJson(req: NextRequest, body: unknown, status: number): NextResponse {
  const id = resolveActivationRequestId(req);
  return NextResponse.json(body, {
    status,
    headers: mergeActivationHeaders(id),
  });
}

export function activationJsonWithId(requestId: string, body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: activationHeaders(requestId),
  });
}

export function activationNoContent(requestId: string): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: activationHeaders(requestId),
  });
}

export function activationRedirect(req: NextRequest, url: string, status: number): NextResponse {
  const id = resolveActivationRequestId(req);
  const res = NextResponse.redirect(url, status);
  res.headers.set(ACTIVATION_REQUEST_ID_HEADER, id);
  return res;
}

export function attachRequestIdToResponse(res: NextResponse, requestId: string): NextResponse {
  res.headers.set(ACTIVATION_REQUEST_ID_HEADER, requestId);
  return res;
}

/** Reserve deny: RFC7807-style fields plus legacy `allowed` / `code` / `message` / `upgrade_url` (licensePreflight). */
export function activationReserveDeny(
  req: NextRequest,
  input: {
    status: number;
    code: string;
    message: string;
    upgrade_url?: string;
  },
): NextResponse {
  const id = resolveActivationRequestId(req);
  const type = `${ACTIVATION_PROBLEM_BASE}/reserve-${input.code.toLowerCase().replace(/_/g, "-")}`;
  const body: Record<string, unknown> = {
    type,
    title: "License reservation denied",
    status: input.status,
    detail: input.message,
    allowed: false,
    code: input.code,
    message: input.message,
  };
  if (input.upgrade_url != null) body.upgrade_url = input.upgrade_url;
  return NextResponse.json(body, {
    status: input.status,
    headers: mergeActivationHeaders(id),
  });
}
