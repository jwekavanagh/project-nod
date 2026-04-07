import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  type KeyObject,
} from "node:crypto";
import { BUNDLE_SIGNATURE_PRIVATE_KEY_INVALID } from "./bundleSignatureCodes.js";
import { sha256Hex } from "./agentRunRecord.js";
import { TruthLayerError } from "./truthLayerError.js";

/** LF endings; trim outer whitespace; ensure trailing newline after PEM block. */
export function normalizeSpkiPemForSidecar(pemUtf8: string): string {
  let s = pemUtf8.replace(/\r\n/g, "\n").trim();
  if (!s.endsWith("\n")) s += "\n";
  return s;
}

function loadEd25519PrivateKeyFromPkcs8Pem(pemUtf8: string): KeyObject {
  try {
    return createPrivateKey({ key: pemUtf8, format: "pem", type: "pkcs8" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TruthLayerError(BUNDLE_SIGNATURE_PRIVATE_KEY_INVALID, msg, { cause: e });
  }
}

/**
 * PKCS#8 PEM Ed25519 private key → sign workflow-result bytes → deterministic sidecar UTF-8 buffer
 * (JSON key order: algorithm, schemaVersion, signatureBase64, signedContentSha256Hex, signingPublicKeySpkiPem; trailing \\n).
 */
export function buildWorkflowResultSigSidecarBytes(
  workflowResultBytes: Buffer,
  privateKeyPemUtf8: string,
): Buffer {
  const privateKey = loadEd25519PrivateKeyFromPkcs8Pem(privateKeyPemUtf8);
  const publicKey = createPublicKey(privateKey);
  const spkiPemRaw = publicKey.export({ type: "spki", format: "pem" });
  if (typeof spkiPemRaw !== "string") {
    throw new TruthLayerError(BUNDLE_SIGNATURE_PRIVATE_KEY_INVALID, "Expected PEM string export");
  }
  const signingPublicKeySpkiPem = normalizeSpkiPemForSidecar(spkiPemRaw);

  const sigBuf = sign(null, workflowResultBytes, privateKey);
  const signedContentSha256Hex = sha256Hex(workflowResultBytes);

  const payload = {
    algorithm: "ed25519",
    schemaVersion: 1,
    signatureBase64: sigBuf.toString("base64"),
    signedContentSha256Hex,
    signingPublicKeySpkiPem,
  };

  return Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
}
