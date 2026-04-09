import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const PREFIX = "wf_sk_live_";
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Format: scrypt$<salt_b64>$<hash_b64> */
export function hashApiKey(plaintext: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plaintext, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyApiKey(plaintext: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1]!, "base64url");
  const expected = Buffer.from(parts[2]!, "base64url");
  const hash = scryptSync(plaintext, salt, expected.length, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

export function generateApiKeyPlaintext(): string {
  return PREFIX + randomBytes(32).toString("hex");
}

export function maskApiKey(k: string): string {
  if (k.length <= 12) return "****";
  return `${k.slice(0, 8)}…${k.slice(-4)}`;
}
