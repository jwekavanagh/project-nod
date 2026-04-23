import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import { getPointer } from "./jsonPointer.js";
import type { ReconcileOutput } from "./reconciler.js";
import type {
  HttpWitnessVerificationRequest,
  MongoDocumentVerificationRequest,
  ObjectStorageVerificationRequest,
  StateWitnessRequest,
  VectorDocumentVerificationRequest,
  VerificationScalar,
} from "./types.js";
import { verificationScalarsEqual } from "./valueVerification.js";
import { SQL_VERIFICATION_OUTCOME_CODE } from "./wireReasonCodes.js";

const S3_DEADLINE_MS = 1900;
const MAX_S3_BODY_HASH_BYTES = 10 * 1024 * 1024;

function setupError(msg: string): ReconcileOutput {
  return {
    status: "incomplete_verification",
    reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.STATE_WITNESS_SETUP_ERROR, message: msg }],
    evidenceSummary: {},
  };
}

async function fetchWithDeadline(url: string, init: RequestInit, deadlineMs: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), deadlineMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

function isAbsoluteHttpOrHttps(s: string): boolean {
  try {
    const { protocol } = new URL(s);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function vectorProviderBaseFromHost(host: string): string {
  const t = host.trim();
  if (isAbsoluteHttpOrHttps(t)) {
    return t;
  }
  return `https://${t}`;
}

async function reconcileVectorDocument(req: VectorDocumentVerificationRequest): Promise<ReconcileOutput> {
  if (req.expectPayloadSha256) {
    return setupError("vector_document: expectPayloadSha256 is not supported yet; use metadataEq");
  }
  const host =
    req.host ??
    (req.provider === "pinecone"
      ? process.env.PINECONE_INDEX_HOST
      : req.provider === "weaviate"
        ? process.env.WEAVIATE_HOST
        : process.env.CHROMA_HOST);
  if (!host || host.length === 0) {
    return setupError(
      `vector_document (${req.provider}): missing host in registry or env (PINECONE_INDEX_HOST / WEAVIATE_HOST / CHROMA_HOST)`,
    );
  }
  const apiKey =
    req.provider === "pinecone"
      ? process.env.PINECONE_API_KEY
      : req.provider === "weaviate"
        ? process.env.WEAVIATE_API_KEY
        : process.env.CHROMA_TENANT_AUTH_TOKEN ?? process.env.CHROMA_API_KEY;
  if (!apiKey) {
    return setupError(`vector_document (${req.provider}): missing API key env`);
  }
  const base = vectorProviderBaseFromHost(host);
  try {
    if (req.provider === "pinecone") {
      const r = await fetchWithDeadline(
        `${base.replace(/\/$/, "")}/vectors/fetch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Api-Key": apiKey },
          body: JSON.stringify({
            ids: [req.documentId],
            ...(req.namespace !== undefined && req.namespace.length > 0 ? { namespace: req.namespace } : {}),
          }),
        },
        8000,
      );
      if (!r.ok) {
        return {
          status: "incomplete_verification",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_PROVIDER_ERROR,
              message: `Pinecone fetch HTTP ${r.status}`,
            },
          ],
          evidenceSummary: { httpStatus: r.status },
        };
      }
      const body = (await r.json()) as { vectors?: Record<string, { metadata?: Record<string, unknown> }> };
      const vec = body.vectors?.[req.documentId];
      if (!vec) {
        return {
          status: "missing",
          reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_NOT_FOUND, message: "Vector id not found in index" }],
          evidenceSummary: { provider: req.provider },
        };
      }
      if (req.metadataSubset) {
        for (const [k, exp] of Object.entries(req.metadataSubset)) {
          const act = vec.metadata?.[k];
          const cmp = verificationScalarsEqual(exp, act as VerificationScalar);
          if (!cmp.ok) {
            return {
              status: "inconsistent",
              reasons: [
                {
                  code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_METADATA_MISMATCH,
                  message: `metadata.${k}: expected ${cmp.expected} found ${cmp.actual}`,
                },
              ],
              evidenceSummary: { field: k },
            };
          }
        }
      }
      return { status: "verified", reasons: [], evidenceSummary: { provider: req.provider, vector: true } };
    }
    if (req.provider === "weaviate") {
      const cls = encodeURIComponent(req.indexName);
      const id = encodeURIComponent(req.documentId);
      const r = await fetchWithDeadline(`${base.replace(/\/$/, "")}/v1/objects/${cls}/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } }, 8000);
      if (r.status === 404) {
        return {
          status: "missing",
          reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_NOT_FOUND, message: "Weaviate object not found" }],
          evidenceSummary: {},
        };
      }
      if (!r.ok) {
        return {
          status: "incomplete_verification",
          reasons: [
            { code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_PROVIDER_ERROR, message: `Weaviate HTTP ${r.status}` },
          ],
          evidenceSummary: { httpStatus: r.status },
        };
      }
      return { status: "verified", reasons: [], evidenceSummary: { provider: "weaviate" } };
    }
    const coll = encodeURIComponent(req.indexName);
    const r = await fetchWithDeadline(
      `${base.replace(/\/$/, "")}/api/v1/collections/${coll}/get`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ ids: [req.documentId] }),
      },
      8000,
    );
    if (!r.ok) {
      return {
        status: "incomplete_verification",
        reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_PROVIDER_ERROR, message: `Chroma HTTP ${r.status}` }],
        evidenceSummary: { httpStatus: r.status },
      };
    }
    const body = (await r.json()) as { ids?: string[] };
    if (!body.ids?.includes(req.documentId)) {
      return {
        status: "missing",
        reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_NOT_FOUND, message: "Chroma id not returned" }],
        evidenceSummary: {},
      };
    }
    return { status: "verified", reasons: [], evidenceSummary: { provider: "chroma" } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "incomplete_verification",
      reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.VECTOR_PROVIDER_ERROR, message: msg }],
      evidenceSummary: { error: true },
    };
  }
}

async function reconcileObjectStorage(req: ObjectStorageVerificationRequest): Promise<ReconcileOutput> {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const client = new S3Client({
    region,
    ...(req.endpoint ? { endpoint: req.endpoint, forcePathStyle: true } : {}),
  });
  const started = Date.now();
  try {
    const head = await Promise.race([
      client.send(new HeadObjectCommand({ Bucket: req.bucket, Key: req.key })),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("S3 head timeout")), S3_DEADLINE_MS)),
    ]);
    const contentLength = Number(head.ContentLength ?? 0);
    if (req.expectSizeBytes !== undefined && contentLength !== req.expectSizeBytes) {
      return {
        status: "inconsistent",
        reasons: [
          {
            code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_SIZE_MISMATCH,
            message: `Expected size ${req.expectSizeBytes} but Content-Length is ${contentLength}`,
          },
        ],
        evidenceSummary: { contentLength },
      };
    }
    if (req.expectEtag !== undefined && head.ETag && head.ETag.replaceAll('"', "") !== req.expectEtag.replaceAll('"', "")) {
      return {
        status: "inconsistent",
        reasons: [
          {
            code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_DIGEST_MISMATCH,
            message: "ETag mismatch",
          },
        ],
        evidenceSummary: {},
      };
    }
    if (req.expectSha256 !== undefined) {
      if (contentLength > MAX_S3_BODY_HASH_BYTES) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_TOO_LARGE_FOR_HASH,
              message: `Object size ${contentLength} exceeds hash cap ${MAX_S3_BODY_HASH_BYTES}`,
            },
          ],
          evidenceSummary: { contentLength },
        };
      }
      const get = await client.send(new GetObjectCommand({ Bucket: req.bucket, Key: req.key }));
      const body = get.Body;
      if (!body || typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray !== "function") {
        return setupError("S3 GetObject body missing or unsupported runtime");
      }
      const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      const hex = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
      if (hex !== req.expectSha256.toLowerCase()) {
        return {
          status: "inconsistent",
          reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_DIGEST_MISMATCH, message: "SHA-256 mismatch" }],
          evidenceSummary: {},
        };
      }
    }
    return {
      status: "verified",
      reasons: [],
      evidenceSummary: { s3: true, elapsedMs: Date.now() - started },
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (String(msg).includes("NotFound") || String(msg).includes("404")) {
      return {
        status: "missing",
        reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_MISSING, message: "S3 object not found" }],
        evidenceSummary: {},
      };
    }
    return {
      status: "incomplete_verification",
      reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.STATE_WITNESS_SETUP_ERROR, message: msg }],
      evidenceSummary: {},
    };
  }
}

async function reconcileHttpWitness(req: HttpWitnessVerificationRequest): Promise<ReconcileOutput> {
  try {
    const r = await fetchWithDeadline(
      req.url,
      { method: req.method, headers: { Accept: "application/json" } },
      8000,
    );
    if (r.status !== req.expectedStatus) {
      return {
        status: "inconsistent",
        reasons: [
          {
            code: SQL_VERIFICATION_OUTCOME_CODE.HTTP_WITNESS_STATUS_MISMATCH,
            message: `HTTP status ${r.status}, expected ${req.expectedStatus}`,
          },
        ],
        evidenceSummary: { httpStatus: r.status },
      };
    }
    const text = await r.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
    if (req.assertions && req.assertions.length > 0) {
      if (typeof parsed !== "object" || parsed === null) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.HTTP_WITNESS_ASSERTION_MISMATCH,
              message: "Response is not a JSON object; cannot apply assertions",
            },
          ],
          evidenceSummary: {},
        };
      }
      const o = parsed as Record<string, unknown>;
      for (const a of req.assertions) {
        const ptr = a.jsonPointer.startsWith("/") ? a.jsonPointer : `/${a.jsonPointer}`;
        const act = getPointer(o, ptr);
        const cmp = verificationScalarsEqual(a.value, act as VerificationScalar);
        if (!cmp.ok) {
          return {
            status: "inconsistent",
            reasons: [
              {
                code: SQL_VERIFICATION_OUTCOME_CODE.HTTP_WITNESS_ASSERTION_MISMATCH,
                message: `Assertion ${ptr}: expected ${cmp.expected} found ${cmp.actual}`,
              },
            ],
            evidenceSummary: { jsonPointer: ptr },
          };
        }
      }
    }
    return { status: "verified", reasons: [], evidenceSummary: { http: true } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "incomplete_verification",
      reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.HTTP_WITNESS_NETWORK_ERROR, message: msg }],
      evidenceSummary: {},
    };
  }
}

async function reconcileMongo(req: MongoDocumentVerificationRequest): Promise<ReconcileOutput> {
  const uri = process.env.AGENTSKEPTIC_MONGO_URL ?? process.env.MONGODB_URI;
  if (!uri) {
    return setupError("mongo_document: set AGENTSKEPTIC_MONGO_URL or MONGODB_URI");
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const doc = await client.db().collection(req.collection).findOne(req.filter);
    if (!doc) {
      return {
        status: "missing",
        reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.MONGO_DOCUMENT_MISSING, message: "No document matched filter" }],
        evidenceSummary: {},
      };
    }
    const plain = doc as Record<string, unknown>;
    for (const [k, exp] of Object.entries(req.requiredFields)) {
      const act = plain[k];
      const cmp = verificationScalarsEqual(exp, act as VerificationScalar);
      if (!cmp.ok) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.MONGO_VALUE_MISMATCH,
              message: `${k}: expected ${cmp.expected} found ${cmp.actual}`,
            },
          ],
          evidenceSummary: { field: k },
        };
      }
    }
    return { status: "verified", reasons: [], evidenceSummary: { mongo: true } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "incomplete_verification",
      reasons: [{ code: SQL_VERIFICATION_OUTCOME_CODE.STATE_WITNESS_SETUP_ERROR, message: msg }],
      evidenceSummary: {},
    };
  } finally {
    await client.close().catch(() => {});
  }
}

export async function reconcileStateWitness(req: StateWitnessRequest): Promise<ReconcileOutput> {
  switch (req.kind) {
    case "vector_document":
      return reconcileVectorDocument(req);
    case "object_storage_object":
      return reconcileObjectStorage(req);
    case "http_witness":
      return reconcileHttpWitness(req);
    case "mongo_document":
      return reconcileMongo(req);
    default:
      return setupError("unknown state witness kind");
  }
}
