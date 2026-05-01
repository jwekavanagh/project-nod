import { describe, it, expect, vi, afterEach } from "vitest";
import { reconcileStateWitness } from "./stateWitness.js";

describe("reconcileStateWitness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  describe("object_storage_object connector not shipped", () => {
    it("rejects TruthLayerError synchronously before AWS imports", async () => {
      await expect(
        reconcileStateWitness({
          kind: "object_storage_object",
          bucket: "b",
          key: "k",
          expectSizeBytes: 1,
          expectEtag: "a",
        }),
      ).rejects.toMatchObject({
        code: "VERIFICATION_CONNECTOR_NOT_SHIPPED",
        message: 'Verification connector "object_storage_object" is not shipped in this OSS package build.',
      });
    });
  });
});
