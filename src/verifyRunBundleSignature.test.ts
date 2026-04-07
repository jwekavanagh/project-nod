import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildAgentRunRecordForBundle, sha256Hex } from "./agentRunRecord.js";
import {
  BUNDLE_SIGNATURE_ARTIFACT_INTEGRITY,
  BUNDLE_SIGNATURE_CRYPTO_INVALID,
  BUNDLE_SIGNATURE_PUBLIC_KEY_MISMATCH,
  BUNDLE_SIGNATURE_SIGNED_HASH_MISMATCH,
  BUNDLE_SIGNATURE_UNSIGNED_MANIFEST,
} from "./bundleSignatureCodes.js";
import {
  AGENT_RUN_FILENAME,
  EVENTS_FILENAME,
  WORKFLOW_RESULT_FILENAME,
  WORKFLOW_RESULT_SIG_FILENAME,
} from "./debugCorpus.js";
import { buildWorkflowResultSigSidecarBytes, normalizeSpkiPemForSidecar } from "./workflowResultSignature.js";
import { verifyRunBundleSignature } from "./verifyRunBundleSignature.js";
import type { WorkflowResult } from "./types.js";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const runOk = join(root, "examples", "debug-corpus", "run_ok");

function writeV2BundleDir(
  dir: string,
  opts: {
    wrBytes: Buffer;
    evBytes: Buffer;
    privatePem: string;
    publicPem: string;
    mutateSidecar?: (parsed: Record<string, unknown>) => void;
  },
): void {
  mkdirSync(dir, { recursive: true });
  let sidecar = buildWorkflowResultSigSidecarBytes(opts.wrBytes, opts.privatePem);
  if (opts.mutateSidecar) {
    const p = JSON.parse(sidecar.toString("utf8").trim()) as Record<string, unknown>;
    opts.mutateSidecar(p);
    sidecar = Buffer.from(`${JSON.stringify(p)}\n`, "utf8");
  }
  const record = buildAgentRunRecordForBundle({
    runId: "t",
    workflowId: (JSON.parse(opts.wrBytes.toString("utf8")) as WorkflowResult).workflowId,
    producer: { name: "n", version: "1" },
    verifiedAt: "2026-04-07T12:00:00.000Z",
    workflowResultBytes: opts.wrBytes,
    eventsBytes: opts.evBytes,
    workflowResultSignatureBytes: sidecar,
  });
  const manifestBuf = Buffer.from(`${JSON.stringify(record, null, 2)}\n`, "utf8");
  writeFileSync(join(dir, EVENTS_FILENAME), opts.evBytes);
  writeFileSync(join(dir, WORKFLOW_RESULT_FILENAME), opts.wrBytes);
  writeFileSync(join(dir, WORKFLOW_RESULT_SIG_FILENAME), sidecar);
  writeFileSync(join(dir, AGENT_RUN_FILENAME), manifestBuf);
}

describe("verifyRunBundleSignature", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const publicPem = publicKey.export({ type: "spki", format: "pem" }) as string;

  const wrBytes = readFileSync(join(runOk, "workflow-result.json"));
  const evBytes = readFileSync(join(runOk, "events.ndjson"));

  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0;
  });

  it("returns ok true for valid v2 bundle", () => {
    const dir = join(tmpdir(), `etl-sig-ok-${Date.now()}`);
    dirs.push(dir);
    writeV2BundleDir(dir, { wrBytes, evBytes, privatePem, publicPem });
    const pubPath = join(dir, "pub.pem");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(publicPem), "utf8");
    const r = verifyRunBundleSignature(dir, pubPath);
    expect(r).toEqual({ ok: true });
  });

  it("tampered workflow-result → ARTIFACT_INTEGRITY", () => {
    const dir = join(tmpdir(), `etl-sig-t1-${Date.now()}`);
    dirs.push(dir);
    writeV2BundleDir(dir, { wrBytes, evBytes, privatePem, publicPem });
    const wrPath = join(dir, WORKFLOW_RESULT_FILENAME);
    const b = readFileSync(wrPath);
    const t = Buffer.from(b);
    t[t.length - 2] ^= 1;
    writeFileSync(wrPath, t);
    const pubPath = join(dir, "pub.pem");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(publicPem), "utf8");
    const r = verifyRunBundleSignature(dir, pubPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BUNDLE_SIGNATURE_ARTIFACT_INTEGRITY);
  });

  it("tampered sidecar bytes → ARTIFACT_INTEGRITY", () => {
    const dir = join(tmpdir(), `etl-sig-t2-${Date.now()}`);
    dirs.push(dir);
    writeV2BundleDir(dir, { wrBytes, evBytes, privatePem, publicPem });
    const sigPath = join(dir, WORKFLOW_RESULT_SIG_FILENAME);
    const b = readFileSync(sigPath);
    const t = Buffer.from(b);
    t[5] ^= 1;
    writeFileSync(sigPath, t);
    const pubPath = join(dir, "pub.pem");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(publicPem), "utf8");
    const r = verifyRunBundleSignature(dir, pubPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BUNDLE_SIGNATURE_ARTIFACT_INTEGRITY);
  });

  it("wrong public key file vs sidecar → PUBLIC_KEY_MISMATCH", () => {
    const dir = join(tmpdir(), `etl-sig-pk-${Date.now()}`);
    dirs.push(dir);
    writeV2BundleDir(dir, { wrBytes, evBytes, privatePem, publicPem });
    const other = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }) as string;
    const pubPath = join(dir, "wrong.pem");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(other), "utf8");
    const r = verifyRunBundleSignature(dir, pubPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BUNDLE_SIGNATURE_PUBLIC_KEY_MISMATCH);
  });

  it("corrupted signatureBase64 → CRYPTO_INVALID", () => {
    const dir = join(tmpdir(), `etl-sig-crypto-${Date.now()}`);
    dirs.push(dir);
    writeV2BundleDir(dir, {
      wrBytes,
      evBytes,
      privatePem,
      publicPem,
      mutateSidecar: (p) => {
        p.signatureBase64 = Buffer.alloc(64, 7).toString("base64");
      },
    });
    const pubPath = join(dir, "pub.pem");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(publicPem), "utf8");
    const r = verifyRunBundleSignature(dir, pubPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BUNDLE_SIGNATURE_CRYPTO_INVALID);
  });

  it("v1 manifest → UNSIGNED_MANIFEST", () => {
    const dir = join(tmpdir(), `etl-sig-v1-${Date.now()}`);
    dirs.push(dir);
    mkdirSync(dir, { recursive: true });
    const rec = buildAgentRunRecordForBundle({
      runId: "x",
      workflowId: "w",
      producer: { name: "n", version: "v" },
      verifiedAt: "2026-04-07T12:00:00.000Z",
      workflowResultBytes: wrBytes,
      eventsBytes: evBytes,
    });
    writeFileSync(join(dir, EVENTS_FILENAME), evBytes);
    writeFileSync(join(dir, WORKFLOW_RESULT_FILENAME), wrBytes);
    writeFileSync(join(dir, AGENT_RUN_FILENAME), `${JSON.stringify(rec, null, 2)}\n`, "utf8");
    const pubPath = join(dir, "pub.pem");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(publicPem), "utf8");
    const r = verifyRunBundleSignature(dir, pubPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BUNDLE_SIGNATURE_UNSIGNED_MANIFEST);
  });

  it("wrong signedContentSha256Hex → SIGNED_HASH_MISMATCH", () => {
    const dir = join(tmpdir(), `etl-sig-hash-${Date.now()}`);
    dirs.push(dir);
    writeV2BundleDir(dir, {
      wrBytes,
      evBytes,
      privatePem,
      publicPem,
      mutateSidecar: (p) => {
        p.signedContentSha256Hex = "a".repeat(64);
      },
    });
    const pubPath = join(dir, "pub.pem");
    writeFileSync(pubPath, normalizeSpkiPemForSidecar(publicPem), "utf8");
    const r = verifyRunBundleSignature(dir, pubPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(BUNDLE_SIGNATURE_SIGNED_HASH_MISMATCH);
  });
});
