import { CLI_OPERATIONAL_CODES } from "./cliOperationalCodes.js";
import { getPointer } from "./jsonPointer.js";
import type { ReconcileOutput } from "./reconciler.js";
import type {
  HttpWitnessVerificationRequest,
  StateWitnessRequest,
  VectorDocumentVerificationRequest,
  VerificationScalar,
} from "./types.js";
import { TruthLayerError } from "./truthLayerError.js";
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
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.VERIFICATION_CONNECTOR_NOT_SHIPPED,
        `Verification connector "object_storage_object" is not shipped in this OSS package build.`,
      );
    case "http_witness":
      return reconcileHttpWitness(req);
    case "mongo_document":
      throw new TruthLayerError(
        CLI_OPERATIONAL_CODES.VERIFICATION_CONNECTOR_NOT_SHIPPED,
        `Verification connector "mongo_document" is not shipped in this OSS package build.`,
      );
    default:
      return setupError("unknown state witness kind");
  }
}
