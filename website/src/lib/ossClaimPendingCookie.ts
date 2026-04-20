import { createHmac, hkdfSync, randomUUID, timingSafeEqual } from "node:crypto";
import { resolveAuthSecret } from "@/lib/authSecret";

/** `__Host-` prefix: Secure, Path=/, no Domain. */
export const OSS_PENDING_CLAIM_COOKIE_NAME = "__Host-as_pc_v1";

export const OSS_PENDING_CLAIM_PAYLOAD_MAX_UTF8 = 512;
/** Upper bound on full `Set-Cookie` value bytes for minted cookie (name=value + attributes). */
export const OSS_PENDING_CLAIM_SET_COOKIE_MAX_BYTES = 3500;

export type OssPendingEnvelopeV1 = {
  v: 1;
  h: string;
  nbf: number;
  exp: number;
};

let cachedSigningKey: Buffer | null = null;

function pendingClaimSigningKey(): Buffer {
  if (cachedSigningKey) return cachedSigningKey;
  const ikm = Buffer.from(resolveAuthSecret(), "utf8");
  cachedSigningKey = Buffer.from(
    hkdfSync("sha256", ikm, Buffer.from("oss_pc_v1", "utf8"), Buffer.from("pending_claim", "utf8"), 32),
  );
  return cachedSigningKey;
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function base64urlDecode(s: string): Buffer | null {
  try {
    return Buffer.from(s, "base64url");
  } catch {
    return null;
  }
}

/**
 * Mint signed envelope. Returns null if TTL math fails or size caps exceeded.
 * `h` must be lowercase 64-char hex (same as `oss_claim_ticket.secret_hash`).
 */
export function signPendingEnvelopeV1(
  h: string,
  expiresAtTicket: Date,
): { cookieValue: string; maxAgeSec: number } | null {
  if (!/^[0-9a-f]{64}$/.test(h)) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const nbf = nowSec - 30;
  const expTicketSec = Math.floor(expiresAtTicket.getTime() / 1000) - 60;
  const exp = Math.min(nowSec + 900, expTicketSec);
  if (exp <= nbf + 60) return null;

  const payload: OssPendingEnvelopeV1 = { v: 1, h, nbf, exp };
  const payloadJson = JSON.stringify(payload);
  if (Buffer.byteLength(payloadJson, "utf8") > OSS_PENDING_CLAIM_PAYLOAD_MAX_UTF8) return null;

  const payloadBuf = Buffer.from(payloadJson, "utf8");
  const mac = createHmac("sha256", pendingClaimSigningKey()).update(payloadBuf).digest();
  const cookieValue = `${base64urlEncode(payloadBuf)}.${base64urlEncode(mac)}`;

  const maxAgeSec = Math.max(1, exp - nowSec);
  const setCookieValueBytes = Buffer.byteLength(
    `${OSS_PENDING_CLAIM_COOKIE_NAME}=${cookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}`,
    "utf8",
  );
  if (setCookieValueBytes > OSS_PENDING_CLAIM_SET_COOKIE_MAX_BYTES) return null;

  return { cookieValue, maxAgeSec };
}

/** Verify HMAC, clock window, and payload shape. Returns null on any failure. */
export function verifyPendingEnvelopeV1(cookieValue: string): OssPendingEnvelopeV1 | null {
  const trimmed = cookieValue.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0) return null;
  const encPayload = trimmed.slice(0, dot);
  const encSig = trimmed.slice(dot + 1);
  if (!encPayload || !encSig) return null;

  const payloadBuf = base64urlDecode(encPayload);
  const sig = base64urlDecode(encSig);
  if (!payloadBuf || !sig) return null;

  const expected = createHmac("sha256", pendingClaimSigningKey()).update(payloadBuf).digest();
  if (expected.length !== sig.length || !timingSafeEqual(expected, sig)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBuf.toString("utf8")) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.v !== 1) return null;
  if (typeof o.h !== "string" || !/^[0-9a-f]{64}$/.test(o.h)) return null;
  if (typeof o.nbf !== "number" || typeof o.exp !== "number") return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec < o.nbf || nowSec > o.exp) return null;

  return { v: 1, h: o.h.toLowerCase(), nbf: o.nbf, exp: o.exp };
}

export function buildSetCookiePendingHeader(value: string, maxAgeSec: number): string {
  return `${OSS_PENDING_CLAIM_COOKIE_NAME}=${value}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

/** Exact clear header per SSOT (Max-Age=0). */
export function buildClearCookiePendingHeader(): string {
  return `${OSS_PENDING_CLAIM_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function newOssClaimPendingRequestId(): string {
  return randomUUID();
}
