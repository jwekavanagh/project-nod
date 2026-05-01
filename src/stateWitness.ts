import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import { createHash } from "node:crypto";
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

const OBJECT_HEAD_DEADLINE_MS = 8000;
const OBJECT_GET_DEADLINE_MS = 30_000;
/** Product cap: bodies larger than this are not fully hashed (normative in docs + conformance). */
const OBJECT_MAX_HASH_BYTES = 10 * 1024 * 1024;

function normalizeS3Etag(etag: string | undefined): string | undefined {
  if (etag === undefined || etag.length === 0) return undefined;
  const t = etag.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) return t.slice(1, -1);
  return t;
}

function isAwsObjectNotFound(err: unknown): boolean {
  const e = err as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === "NotFound" ||
    e.Code === "NotFound" ||
    e.code === "NotFound" ||
    e.$metadata?.httpStatusCode === 404
  );
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function reconcileObjectStorage(req: ObjectStorageVerificationRequest): Promise<ReconcileOutput> {
  const client = new S3Client({
    region:
      process.env.AWS_REGION?.trim() ||
      process.env.AWS_DEFAULT_REGION?.trim() ||
      "us-east-1",
    ...(req.endpoint?.trim()
      ? { endpoint: req.endpoint.trim(), forcePathStyle: true as const }
      : {}),
  });

  let headContentLength: number | undefined;
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: req.bucket, Key: req.key }),
      { abortSignal: AbortSignal.timeout(OBJECT_HEAD_DEADLINE_MS) },
    );
    headContentLength = head.ContentLength;

    if (req.expectSizeBytes !== undefined && head.ContentLength !== undefined) {
      if (Number(head.ContentLength) !== req.expectSizeBytes) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_SIZE_MISMATCH,
              message: `expected size ${req.expectSizeBytes} bytes, HeadObject reports ${String(head.ContentLength)}`,
            },
          ],
          evidenceSummary: { contentLength: head.ContentLength, s3: true },
        };
      }
    }

    if (req.expectEtag !== undefined) {
      const want = normalizeS3Etag(req.expectEtag);
      const got = normalizeS3Etag(head.ETag);
      if (want !== got) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_METADATA_MISMATCH,
              message: `ETag mismatch (expected ${want ?? "∅"}, got ${got ?? "∅"})`,
            },
          ],
          evidenceSummary: { s3: true },
        };
      }
    }

    if (req.expectSha256 !== undefined) {
      const want = req.expectSha256.trim().toLowerCase();
      if (head.ContentLength !== undefined && head.ContentLength > OBJECT_MAX_HASH_BYTES) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_TOO_LARGE_FOR_HASH,
              message: `object Content-Length ${String(head.ContentLength)} exceeds hash cap (${OBJECT_MAX_HASH_BYTES} bytes)`,
            },
          ],
          evidenceSummary: { contentLength: head.ContentLength, s3: true },
        };
      }

      let getOut;
      try {
        getOut = await client.send(
          new GetObjectCommand({ Bucket: req.bucket, Key: req.key }),
          { abortSignal: AbortSignal.timeout(OBJECT_GET_DEADLINE_MS) },
        );
      } catch (e) {
        if (isAwsObjectNotFound(e)) {
          return {
            status: "missing",
            reasons: [
              {
                code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_MISSING,
                message: "S3 object not found on GetObject",
              },
            ],
            evidenceSummary: { s3: true },
          };
        }
        return {
          status: "incomplete_verification",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.STATE_WITNESS_SETUP_ERROR,
              message: `object_storage: GetObject failed (${errMessage(e)})`,
            },
          ],
          evidenceSummary: { error: true, s3: true },
        };
      }

      const sdkBody = getOut.Body;
      if (!sdkBody || typeof sdkBody.transformToByteArray !== "function") {
        return setupError("object_storage: GetObject returned unreadable body");
      }
      const bytes = Buffer.from(await sdkBody.transformToByteArray());
      if (bytes.byteLength > OBJECT_MAX_HASH_BYTES) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_TOO_LARGE_FOR_HASH,
              message: `object body (${bytes.byteLength} bytes) exceeds hash cap (${OBJECT_MAX_HASH_BYTES} bytes)`,
            },
          ],
          evidenceSummary: { contentLength: bytes.byteLength, s3: true },
        };
      }
      const hex = createHash("sha256").update(bytes).digest("hex");
      if (hex.toLowerCase() !== want) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_DIGEST_MISMATCH,
              message: "SHA-256 digest does not match expected value",
            },
          ],
          evidenceSummary: { contentLength: bytes.byteLength, s3: true },
        };
      }
    }

    return { status: "verified", reasons: [], evidenceSummary: { s3: true } };
  } catch (e) {
    if (isAwsObjectNotFound(e)) {
      return {
        status: "missing",
        reasons: [
          {
            code: SQL_VERIFICATION_OUTCOME_CODE.OBJECT_MISSING,
            message: "S3 object not found (HeadObject)",
          },
        ],
        evidenceSummary: { s3: true },
      };
    }
    return {
      status: "incomplete_verification",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.STATE_WITNESS_SETUP_ERROR,
          message: `object_storage: HeadObject failed (${errMessage(e)})`,
        },
      ],
      evidenceSummary: { error: true, s3: true },
    };
  }
}

async function reconcileMongoDocument(req: MongoDocumentVerificationRequest): Promise<ReconcileOutput> {
  const uri = process.env.AGENTSKEPTIC_MONGO_URL?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) {
    return setupError("mongo_document: set AGENTSKEPTIC_MONGO_URL or MONGODB_URI");
  }

  let client: MongoClient | undefined;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    await client.connect();
    const doc = await client.db().collection(req.collection).findOne(req.filter);
    if (!doc) {
      return {
        status: "missing",
        reasons: [
          {
            code: SQL_VERIFICATION_OUTCOME_CODE.MONGO_DOCUMENT_MISSING,
            message: "No MongoDB document matched the filter",
          },
        ],
        evidenceSummary: {},
      };
    }

    const plain = doc as Record<string, unknown>;
    for (const [field, expected] of Object.entries(req.requiredFields)) {
      const cmp = verificationScalarsEqual(expected, plain[field]);
      if (!cmp.ok) {
        return {
          status: "inconsistent",
          reasons: [
            {
              code: SQL_VERIFICATION_OUTCOME_CODE.MONGO_VALUE_MISMATCH,
              message: `${field}: expected ${cmp.expected} found ${cmp.actual}`,
              field,
            },
          ],
          evidenceSummary: { field, mongo: true },
        };
      }
    }

    return { status: "verified", reasons: [], evidenceSummary: { mongo: true } };
  } catch (e) {
    return {
      status: "incomplete_verification",
      reasons: [
        {
          code: SQL_VERIFICATION_OUTCOME_CODE.STATE_WITNESS_SETUP_ERROR,
          message: `mongo_document: ${errMessage(e)}`,
        },
      ],
      evidenceSummary: { error: true },
    };
  } finally {
    try {
      await client?.close();
    } catch {
      /* ignore */
    }
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

export async function reconcileStateWitness(req: StateWitnessRequest): Promise<ReconcileOutput> {
  switch (req.kind) {
    case "vector_document":
      return reconcileVectorDocument(req);
    case "object_storage_object":
      return reconcileObjectStorage(req);
    case "http_witness":
      return reconcileHttpWitness(req);
    case "mongo_document":
      return reconcileMongoDocument(req);
    default:
      return setupError("unknown state witness kind");
  }
}
