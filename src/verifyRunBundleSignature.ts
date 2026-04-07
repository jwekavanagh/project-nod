import { createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  BUNDLE_SIGNATURE_ARTIFACT_INTEGRITY,
  BUNDLE_SIGNATURE_CRYPTO_INVALID,
  BUNDLE_SIGNATURE_MANIFEST_INVALID,
  BUNDLE_SIGNATURE_MANIFEST_UNSUPPORTED_VERSION,
  BUNDLE_SIGNATURE_MISSING_ARTIFACT,
  BUNDLE_SIGNATURE_PUBLIC_KEY_MISMATCH,
  BUNDLE_SIGNATURE_SIDECAR_INVALID,
  BUNDLE_SIGNATURE_SIGNED_HASH_MISMATCH,
  BUNDLE_SIGNATURE_UNSIGNED_MANIFEST,
  type BundleSignatureCode,
} from "./bundleSignatureCodes.js";
import { sha256Hex, type AgentRunRecordV2 } from "./agentRunRecord.js";
import { loadSchemaValidator } from "./schemaLoad.js";
import {
  AGENT_RUN_FILENAME,
  EVENTS_FILENAME,
  WORKFLOW_RESULT_FILENAME,
  WORKFLOW_RESULT_SIG_FILENAME,
} from "./debugCorpus.js";
import { normalizeSpkiPemForSidecar } from "./workflowResultSignature.js";

export type RunBundleSignatureResult =
  | { ok: true }
  | { ok: false; code: BundleSignatureCode; message: string };

const validateV2 = loadSchemaValidator("agent-run-record-v2");
const validateSidecar = loadSchemaValidator("workflow-result-signature");

function fail(code: BundleSignatureCode, message: string): RunBundleSignatureResult {
  return { ok: false, code, message };
}

/**
 * Normative verify order (1–9): manifest parse + dispatch; events hash; wr hash; sig hash; sidecar parse+schema;
 * signedContentSha256Hex vs manifest; PEM equality; crypto.verify.
 */
export function verifyRunBundleSignature(
  runDir: string,
  ed25519PublicKeyPemPath: string,
): RunBundleSignatureResult {
  const resolved = path.resolve(runDir);
  const agentRunPath = path.join(resolved, AGENT_RUN_FILENAME);

  if (!existsSync(agentRunPath)) {
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, `Missing ${AGENT_RUN_FILENAME}`);
  }

  let agentRunParsed: unknown;
  try {
    agentRunParsed = JSON.parse(readFileSync(agentRunPath, "utf8")) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(BUNDLE_SIGNATURE_MANIFEST_INVALID, msg);
  }

  const sv = (agentRunParsed as { schemaVersion?: unknown }).schemaVersion;
  if (sv !== 1 && sv !== 2) {
    return fail(
      BUNDLE_SIGNATURE_MANIFEST_UNSUPPORTED_VERSION,
      `schemaVersion must be 1 or 2, got ${String(sv)}`,
    );
  }

  if (sv === 1) {
    return fail(BUNDLE_SIGNATURE_UNSIGNED_MANIFEST, "Bundle manifest is unsigned (schemaVersion 1)");
  }

  if (!validateV2(agentRunParsed)) {
    return fail(
      BUNDLE_SIGNATURE_MANIFEST_INVALID,
      `${AGENT_RUN_FILENAME} failed agent-run-record-v2 schema validation.`,
    );
  }

  const record = agentRunParsed as AgentRunRecordV2;
  const evSpec = record.artifacts.events;
  const wrSpec = record.artifacts.workflowResult;
  const sigSpec = record.artifacts.workflowResultSignature;

  const evPath = path.join(resolved, evSpec.relativePath);
  const wrPath = path.join(resolved, wrSpec.relativePath);
  const sigPath = path.join(resolved, sigSpec.relativePath);

  if (!existsSync(evPath)) {
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, `Missing ${EVENTS_FILENAME}`);
  }
  let evBuf: Buffer;
  try {
    evBuf = readFileSync(evPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, msg);
  }
  if (evBuf.length !== evSpec.byteLength || sha256Hex(evBuf) !== evSpec.sha256) {
    return fail(BUNDLE_SIGNATURE_ARTIFACT_INTEGRITY, `${EVENTS_FILENAME} does not match manifest`);
  }

  if (!existsSync(wrPath)) {
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, `Missing ${WORKFLOW_RESULT_FILENAME}`);
  }
  let wrBuf: Buffer;
  try {
    wrBuf = readFileSync(wrPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, msg);
  }
  if (wrBuf.length !== wrSpec.byteLength || sha256Hex(wrBuf) !== wrSpec.sha256) {
    return fail(
      BUNDLE_SIGNATURE_ARTIFACT_INTEGRITY,
      `${WORKFLOW_RESULT_FILENAME} does not match manifest`,
    );
  }

  if (!existsSync(sigPath)) {
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, `Missing ${WORKFLOW_RESULT_SIG_FILENAME}`);
  }
  let sigFileBuf: Buffer;
  try {
    sigFileBuf = readFileSync(sigPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, msg);
  }
  if (sigFileBuf.length !== sigSpec.byteLength || sha256Hex(sigFileBuf) !== sigSpec.sha256) {
    return fail(
      BUNDLE_SIGNATURE_ARTIFACT_INTEGRITY,
      `${WORKFLOW_RESULT_SIG_FILENAME} does not match manifest`,
    );
  }

  let sidecar: unknown;
  try {
    sidecar = JSON.parse(sigFileBuf.toString("utf8")) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(BUNDLE_SIGNATURE_SIDECAR_INVALID, msg);
  }

  if (!validateSidecar(sidecar)) {
    return fail(BUNDLE_SIGNATURE_SIDECAR_INVALID, "workflow-result.sig.json failed schema validation");
  }

  const sc = sidecar as { signedContentSha256Hex?: string };
  if (sc.signedContentSha256Hex !== wrSpec.sha256) {
    return fail(BUNDLE_SIGNATURE_SIGNED_HASH_MISMATCH, "signedContentSha256Hex does not match manifest");
  }

  let trustedPem: string;
  try {
    trustedPem = readFileSync(path.resolve(ed25519PublicKeyPemPath), "utf8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(BUNDLE_SIGNATURE_MISSING_ARTIFACT, `Cannot read public key: ${msg}`);
  }

  const sidecarPem = (sidecar as { signingPublicKeySpkiPem?: string }).signingPublicKeySpkiPem;
  if (typeof sidecarPem !== "string") {
    return fail(BUNDLE_SIGNATURE_SIDECAR_INVALID, "Missing signingPublicKeySpkiPem");
  }

  if (normalizeSpkiPemForSidecar(sidecarPem) !== normalizeSpkiPemForSidecar(trustedPem)) {
    return fail(BUNDLE_SIGNATURE_PUBLIC_KEY_MISMATCH, "Public key file does not match sidecar PEM");
  }

  const publicKey = createPublicKey({ key: trustedPem, format: "pem", type: "spki" });
  const sigB64 = (sidecar as { signatureBase64?: string }).signatureBase64;
  if (typeof sigB64 !== "string") {
    return fail(BUNDLE_SIGNATURE_SIDECAR_INVALID, "Missing signatureBase64");
  }
  let sigBytes: Buffer;
  try {
    sigBytes = Buffer.from(sigB64, "base64");
  } catch {
    return fail(BUNDLE_SIGNATURE_SIDECAR_INVALID, "Invalid signatureBase64");
  }

  const ok = verify(null, wrBuf, publicKey, sigBytes);
  if (!ok) {
    return fail(BUNDLE_SIGNATURE_CRYPTO_INVALID, "Ed25519 verify failed");
  }

  return { ok: true };
}
