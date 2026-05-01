import { afterEach, describe, expect, it, vi } from "vitest";
import { reconcileStateWitness } from "./stateWitness.js";

const s3SendMock = vi.hoisted(() => vi.fn());
vi.mock("@aws-sdk/client-s3", () => {
  class HeadObjectCommand {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public input: any) {}
  }
  class GetObjectCommand {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public input: any) {}
  }
  class S3Client {
    send = s3SendMock;
  }
  return { HeadObjectCommand, GetObjectCommand, S3Client };
});

const mongoConnectMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mongoCloseMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mongoFindOneMock = vi.hoisted(() => vi.fn());
vi.mock("mongodb", () => {
  class MongoClient {
    constructor() {}
    async connect() {
      return mongoConnectMock();
    }
    async close() {
      return mongoCloseMock();
    }
    db() {
      return {
        collection() {
          return { findOne: mongoFindOneMock };
        },
      };
    }
  }
  return { MongoClient };
});

describe("reconcileStateWitness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    s3SendMock.mockReset();
    mongoConnectMock.mockClear();
    mongoCloseMock.mockClear();
    mongoFindOneMock.mockReset();
    delete process.env.MONGODB_URI;
    delete process.env.AGENTSKEPTIC_MONGO_URL;
  });

  describe("http_witness", () => {
    it("returns verified when status and JSON assertions match", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ ok: true, n: 1 }), { status: 200 })),
      );
      const out = await reconcileStateWitness({
        kind: "http_witness",
        method: "GET",
        url: "http://witness.test/health",
        expectedStatus: 200,
        assertions: [{ jsonPointer: "/ok", value: true }],
      });
      expect(out.status).toBe("verified");
    });

    it("returns inconsistent on HTTP status mismatch", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({}), { status: 500 })),
      );
      const out = await reconcileStateWitness({
        kind: "http_witness",
        method: "GET",
        url: "http://witness.test/x",
        expectedStatus: 200,
      });
      expect(out.status).toBe("inconsistent");
      expect(out.reasons[0]?.code).toBe("HTTP_WITNESS_STATUS_MISMATCH");
    });
  });

  describe("vector_document (pinecone)", () => {
    it("returns verified when fetch returns matching vector metadata", async () => {
      const prevHost = process.env.PINECONE_INDEX_HOST;
      const prevKey = process.env.PINECONE_API_KEY;
      process.env.PINECONE_INDEX_HOST = "https://pinecone.test";
      process.env.PINECONE_API_KEY = "secret";
      try {
        vi.stubGlobal(
          "fetch",
          vi.fn(async () =>
            new Response(
              JSON.stringify({
                vectors: { "doc-1": { metadata: { tier: "gold" } } },
              }),
              { status: 200 },
            ),
          ),
        );
        const out = await reconcileStateWitness({
          kind: "vector_document",
          provider: "pinecone",
          documentId: "doc-1",
          indexName: "idx",
          metadataSubset: { tier: "gold" },
        });
        expect(out.status).toBe("verified");
      } finally {
        if (prevHost === undefined) delete process.env.PINECONE_INDEX_HOST;
        else process.env.PINECONE_INDEX_HOST = prevHost;
        if (prevKey === undefined) delete process.env.PINECONE_API_KEY;
        else process.env.PINECONE_API_KEY = prevKey;
      }
    });
  });

  describe("object_storage_object", () => {
    it("returns verified when HeadObject checks pass without digest", async () => {
      s3SendMock.mockResolvedValueOnce({ ContentLength: 10, ETag: `"abc"` });
      const out = await reconcileStateWitness({
        kind: "object_storage_object",
        bucket: "bkt",
        key: "path/k",
        expectSizeBytes: 10,
        expectEtag: "abc",
      });
      expect(out.status).toBe("verified");
      expect(out.evidenceSummary).toMatchObject({ s3: true });
    });

    it("returns missing on S3 NotFound", async () => {
      const err = Object.assign(new Error("not found"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
      s3SendMock.mockRejectedValueOnce(err);
      const out = await reconcileStateWitness({
        kind: "object_storage_object",
        bucket: "bkt",
        key: "path/missing",
      });
      expect(out.status).toBe("missing");
      expect(out.reasons[0]?.code).toBe("OBJECT_MISSING");
    });

    it("returns inconsistent on digest mismatch after GetObject", async () => {
      s3SendMock
        .mockResolvedValueOnce({ ContentLength: 5 })
        .mockResolvedValueOnce({
          Body: {
            async transformToByteArray() {
              return new Uint8Array([104, 101, 108, 108, 111]); // "hello"
            },
          },
        });
      const out = await reconcileStateWitness({
        kind: "object_storage_object",
        bucket: "bkt",
        key: "path/o",
        expectSha256: "0000000000000000000000000000000000000000000000000000000000000000",
      });
      expect(out.status).toBe("inconsistent");
      expect(out.reasons[0]?.code).toBe("OBJECT_DIGEST_MISMATCH");
    });
  });

  describe("mongo_document", () => {
    it("returns incomplete when Mongo URI env is absent", async () => {
      const out = await reconcileStateWitness({
        kind: "mongo_document",
        collection: "items",
        filter: { id: "1" },
        requiredFields: { name: "a" },
      });
      expect(out.status).toBe("incomplete_verification");
      expect(out.reasons[0]?.message).toMatch(/AGENTSKEPTIC_MONGO_URL|MONGODB_URI/);
    });

    it("returns verified when findOne matches requiredFields", async () => {
      process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/unit";
      mongoFindOneMock.mockResolvedValueOnce({ name: "Alice", qty: 1 });
      const out = await reconcileStateWitness({
        kind: "mongo_document",
        collection: "items",
        filter: { _id: "x" },
        requiredFields: { name: "Alice", qty: 1 },
      });
      expect(out.status).toBe("verified");
      expect(out.evidenceSummary).toMatchObject({ mongo: true });
      expect(mongoCloseMock).toHaveBeenCalled();
    });
  });
});
